/**
 * Preenche lotação (unidade/regional/função/admissão) em stubs criados
 * pela planilha ocupacional, a partir da aba ASO 2026.
 *
 * Uso: npx tsx scripts/backfill-planilha-lotacao.ts [--file="./Planilha Sistema Saúde.xlsx"] [--dry]
 *
 * Não sobrescreve lotação já preenchida.
 */
import { config } from "dotenv";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { Client } from "pg";

config({ path: resolve(process.cwd(), ".env.local") });

function arg(name: string) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRegionCode(value: string) {
  const n = normalizeText(value);
  if (n === "CENTRO" || n === "CENTRAL") return "CENTRO";
  if (n === "OESTE") return "SUL";
  return n || "NAO_INFORMADA";
}

function cell(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const found = Object.keys(row).find(
      (k) => normalizeText(k) === normalizeText(key),
    );
    if (found && row[found] != null && String(row[found]).trim() !== "") {
      return String(row[found]).trim();
    }
  }
  return "";
}

function excelDate(value: string): string | null {
  if (!value) return null;
  if (/^\d+(\.\d+)?$/.test(value)) {
    const n = Number(value);
    if (n < 20000 || n > 60000) return null;
    const d = XLSX.SSF.parse_date_code(n);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function rememberEmp(
  map: Map<string, { id: string; unit_id: string | null }>,
  registration: string,
  emp: { id: string; unit_id: string | null },
) {
  map.set(registration, emp);
  const digits = registration.replace(/\D/g, "");
  if (digits) {
    map.set(digits, emp);
    for (const pad of [5, 6, 7, 8]) map.set(digits.padStart(pad, "0"), emp);
  }
}

async function main() {
  const dry = hasFlag("dry");
  const file =
    arg("file") ||
    readdirSync(process.cwd()).find((f) =>
      /^Planilha Sistema.*\.xlsx$/i.test(f),
    );
  if (!file || !existsSync(file)) {
    throw new Error(
      'Arquivo não encontrado. Use --file="./Planilha Sistema Saúde.xlsx"',
    );
  }

  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");

  console.time("total");
  console.log("Lendo", file);
  const wb = XLSX.readFile(file);
  const sheet = wb.Sheets["ASO 2026"];
  if (!sheet) throw new Error('Aba "ASO 2026" não encontrada');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  console.log("Linhas ASO:", rows.length);

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const units = await client.query<{
    id: string;
    name: string;
    region_id: string;
    region_code: string;
    region_name: string;
  }>(`
    select u.id, u.name, u.region_id, r.code as region_code, r.name as region_name
    from core.units u
    join core.regions r on r.id = u.region_id
    where u.deleted_at is null
  `);
  const unitByNorm = new Map(units.rows.map((u) => [normalizeText(u.name), u]));

  const regions = await client.query<{ id: string; code: string; name: string }>(
    `select id, code, name from core.regions where deleted_at is null`,
  );
  const regionByCode = new Map(regions.rows.map((r) => [r.code, r]));

  const roles = await client.query<{ id: string; normalized_name: string }>(
    `select id, normalized_name from core.job_roles`,
  );
  const roleByNorm = new Map(roles.rows.map((r) => [r.normalized_name, r.id]));

  const emps = await client.query<{
    id: string;
    registration: string;
    unit_id: string | null;
  }>(
    `select id, registration, unit_id from core.employees where deleted_at is null`,
  );
  const empByReg = new Map<string, { id: string; unit_id: string | null }>();
  for (const e of emps.rows) rememberEmp(empByReg, e.registration, e);
  console.log("Colaboradores:", emps.rows.length);

  type EmpPatch = {
    id: string;
    unitId: string | null;
    regionId: string | null;
    regionName: string | null;
    unitName: string | null;
    jobRoleId: string | null;
    admission: string | null;
  };
  const patches = new Map<string, EmpPatch>();
  let skipped = 0;
  let missingUnit = 0;
  const missingUnitNames = new Set<string>();
  const rolesToCreate: Array<{ name: string; normalized: string }> = [];

  for (const row of rows) {
    const registration = cell(row, "Funcionário", "Matrícula", "Matricula");
    if (!registration) {
      skipped += 1;
      continue;
    }
    const emp = empByReg.get(registration.trim())
      ?? empByReg.get(registration.replace(/\D/g, ""));
    if (!emp || emp.unit_id) {
      skipped += 1;
      continue;
    }
    if (patches.has(emp.id)) continue;

    const department = cell(row, "Departamento", "UNIDADE");
    const roleName = cell(row, "Função", "FUNÇÃO");
    const regionRaw = cell(row, "Regional");
    const admission = excelDate(cell(row, "Admissão", "Admissao"));

    const unit = department ? unitByNorm.get(normalizeText(department)) : undefined;
    if (department && !unit) {
      missingUnit += 1;
      missingUnitNames.add(department);
    }

    let regionId = unit?.region_id ?? null;
    let regionName = unit?.region_name ?? null;
    if (!regionId && regionRaw) {
      const region = regionByCode.get(normalizeRegionCode(regionRaw));
      if (region) {
        regionId = region.id;
        regionName = region.name;
      }
    }

    let jobRoleId: string | null = null;
    if (roleName) {
      const normalized = normalizeText(roleName);
      jobRoleId = roleByNorm.get(normalized) ?? null;
      if (!jobRoleId) {
        rolesToCreate.push({ name: roleName, normalized });
        // placeholder; filled after insert
        jobRoleId = `__NEW__:${normalized}`;
      }
    }

    patches.set(emp.id, {
      id: emp.id,
      unitId: unit?.id ?? null,
      regionId,
      regionName,
      unitName: unit?.name ?? null,
      jobRoleId,
      admission,
    });
  }

  console.log("Patches:", patches.size, "roles novas:", rolesToCreate.length);

  if (!dry) {
    // cria funções faltantes
    const uniqueRoles = [
      ...new Map(rolesToCreate.map((r) => [r.normalized, r])).values(),
    ];
    for (const role of uniqueRoles) {
      const created = await client.query<{ id: string }>(
        `insert into core.job_roles (name, normalized_name)
         values ($1, $2)
         on conflict do nothing
         returning id`,
        [role.name, role.normalized],
      );
      let id = created.rows[0]?.id;
      if (!id) {
        const existing = await client.query<{ id: string }>(
          `select id from core.job_roles where normalized_name = $1 limit 1`,
          [role.normalized],
        );
        id = existing.rows[0]?.id;
      }
      if (id) roleByNorm.set(role.normalized, id);
    }

    await client.query("begin");
    try {
      let updatedEmp = 0;
      for (const patch of patches.values()) {
        let jobRoleId = patch.jobRoleId;
        if (jobRoleId?.startsWith("__NEW__:")) {
          jobRoleId = roleByNorm.get(jobRoleId.slice(8)) ?? null;
        }
        const res = await client.query(
          `update core.employees
           set unit_id = coalesce(unit_id, $2),
               region_id = coalesce(region_id, $3),
               job_role_id = coalesce(job_role_id, $4),
               admission_date = coalesce(admission_date, $5::date),
               updated_at = now()
           where id = $1 and unit_id is null`,
          [patch.id, patch.unitId, patch.regionId, jobRoleId, patch.admission],
        );
        updatedEmp += res.rowCount ?? 0;
      }

      const empIds = [...patches.keys()];
      let updatedPlans = 0;
      let updatedRecords = 0;
      for (let i = 0; i < empIds.length; i += 100) {
        const chunk = empIds.slice(i, i + 100);
        for (const id of chunk) {
          const p = patches.get(id)!;
          if (!p.unitId && !p.regionId) continue;
          const planUpd = await client.query(
            `update occupational.aso_monthly_plans
             set unit_id = coalesce(unit_id, $2),
                 region_id = coalesce(region_id, $3),
                 unit_name_snapshot = coalesce(unit_name_snapshot, $4),
                 region_name_snapshot = coalesce(region_name_snapshot, $5),
                 updated_at = now()
             where deleted_at is null and employee_id = $1
               and (unit_id is null or region_id is null)`,
            [id, p.unitId, p.regionId, p.unitName, p.regionName],
          );
          updatedPlans += planUpd.rowCount ?? 0;
          const recUpd = await client.query(
            `update occupational.aso_records
             set unit_id = coalesce(unit_id, $2),
                 region_id = coalesce(region_id, $3),
                 updated_at = now()
             where deleted_at is null and employee_id = $1
               and (unit_id is null or region_id is null)`,
            [id, p.unitId, p.regionId],
          );
          updatedRecords += recUpd.rowCount ?? 0;
        }
      }

      await client.query("commit");
      console.log(
        JSON.stringify(
          {
            dry,
            updatedEmp,
            updatedPlans,
            updatedRecords,
            skipped,
            missingUnit,
            missingUnitNames: [...missingUnitNames].slice(0, 20),
          },
          null,
          2,
        ),
      );
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  } else {
    console.log(
      JSON.stringify(
        {
          dry,
          wouldUpdate: patches.size,
          skipped,
          missingUnit,
          missingUnitNames: [...missingUnitNames].slice(0, 20),
        },
        null,
        2,
      ),
    );
  }

  const check = await client.query(
    `select e.registration, e.full_name, u.name as unit, r.code as region,
            j.name as role, e.admission_date::text as admission_date,
            p.unit_name_snapshot, p.region_name_snapshot, p.alterdata_status
     from core.employees e
     left join core.units u on u.id = e.unit_id
     left join core.regions r on r.id = e.region_id
     left join core.job_roles j on j.id = e.job_role_id
     left join occupational.aso_monthly_plans p
       on p.employee_id = e.id and p.deleted_at is null
     where e.deleted_at is null
       and (e.registration in ('3540','03540','003540')
            or e.full_name ilike '%DANIELA MARIA VIEIRA BEZERRA%')`,
  );
  console.log("DANIELA", JSON.stringify(check.rows, null, 2));

  const orphans = await client.query(
    `select count(*)::int as n from core.employees
     where deleted_at is null and unit_id is null and functional_status = 'ATIVO'`,
  );
  console.log("ATIVOS_SEM_UNIDADE", orphans.rows[0]);

  await client.end();
  console.timeEnd("total");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
