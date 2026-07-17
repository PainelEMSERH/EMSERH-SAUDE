/**
 * Reconstrói planos PERIODICO 2026 a partir da aba oficial ASO 2026 (coluna Mês).
 *
 * Regra:
 * - Mês = competência planejada (meta do mês)
 * - Data_Atestado_(2026) = evidência de realização (pode ser antecipada)
 * - Antecipação NÃO move o plano para o mês do atestado
 *
 * Uso: npx tsx scripts/rebuild-plans-from-aso2026.ts [--apply] [--region=SUL] [--month=1]
 */
import { config } from "dotenv";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { Client } from "pg";
import { parseSheetDate } from "../src/lib/dates";
import { mapAlterdataFunctionalStatus } from "../src/lib/employees/alterdata-status";
import { eligibilityFromFunctionalStatus } from "../src/lib/aso/planning";

config({ path: resolve(process.cwd(), ".env.local") });

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cell(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const found = Object.keys(row).find((k) => norm(k) === norm(key));
    if (found && row[found] != null && String(row[found]).trim() !== "") {
      return row[found];
    }
  }
  return "";
}

function regKey(v: unknown) {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.replace(/^0+/, "") || "0";
}

function regionCode(raw: string) {
  const n = norm(raw);
  if (n === "OESTE" || n === "SUL") return "SUL";
  if (n === "CENTRO" || n === "CENTRAL") return "CENTRO";
  if (n === "NORTE") return "NORTE";
  if (n === "LESTE") return "LESTE";
  return n || "NAO_INFORMADA";
}

function isPeriodico(raw: string) {
  return norm(raw).includes("PERIOD");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const onlyRegion = process.argv
    .find((a) => a.startsWith("--region="))
    ?.slice("--region=".length)
    ?.toUpperCase();
  const onlyMonth = process.argv
    .find((a) => a.startsWith("--month="))
    ?.slice("--month=".length);
  const monthFilter = onlyMonth ? Number(onlyMonth) : null;

  const file =
    readdirSync(process.cwd()).find((f) =>
      /^Planilha Sistema.*\.xlsx$/i.test(f),
    ) || "Planilha Sistema Saúde.xlsx";
  if (!existsSync(file)) throw new Error("Planilha não encontrada");

  const wb = XLSX.readFile(file);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets["ASO 2026"],
    { defval: "" },
  );

  type PlanRow = {
    reg: string;
    name: string;
    month: number;
    expected: string | null;
    performed: string | null;
    region: string;
    unit: string;
    demissao: string | null;
    functional: string;
  };

  const plans: PlanRow[] = [];
  for (const row of rows) {
    const tipo = String(cell(row, "Tipo Proximo ASO") || "");
    if (!isPeriodico(tipo)) continue;
    const month = Number(cell(row, "Mês", "Mes"));
    if (!Number.isFinite(month) || month < 1 || month > 12) continue;
    if (monthFilter && month !== monthFilter) continue;

    const region = regionCode(String(cell(row, "Regional") || ""));
    if (onlyRegion && region !== onlyRegion) continue;

    const demissao = parseSheetDate(
      cell(row, "Demissão", "DtDemissao") as string | number,
    );
    // Fora do ano: não entra no planejamento 2026
    if (demissao && demissao < "2026-01-01") continue;

    const functional = mapAlterdataFunctionalStatus({
      dismissalRaw: demissao || "",
      statusAso: "",
      afastamentoRaw: String(cell(row, "Afastamento") || ""),
      statusFerias: String(cell(row, "Status_Férias", "Status_Ferias") || ""),
      leaveStartRaw: cell(row, "Início Afastamento", "Inicio Afastamento") as
        | string
        | number,
      leaveEndRaw: cell(row, "Fim Afastamento") as string | number,
      todayIso: "2026-07-17",
    });

    // No mês da demissão: vira demissional, não periódico
    if (demissao && demissao.startsWith(`2026-${String(month).padStart(2, "0")}`)) {
      continue;
    }
    if (demissao && demissao < `2026-${String(month).padStart(2, "0")}-01`) {
      continue;
    }

    const expected =
      parseSheetDate(cell(row, "Data Proximo ASO") as string | number) ||
      `2026-${String(month).padStart(2, "0")}-01`;

    plans.push({
      reg: regKey(cell(row, "Funcionário", "Matrícula")),
      name: String(cell(row, "Nome do Funcionário", "Nome") || "").trim(),
      month,
      expected,
      performed: parseSheetDate(
        cell(row, "Data_Atestado_(2026)") as string | number,
      ),
      region,
      unit: String(cell(row, "Departamento") || ""),
      demissao,
      functional,
    });
  }

  console.log(
    JSON.stringify(
      {
        fonte: "ASO 2026 · Mês · Periodico",
        filtro: { region: onlyRegion || "ALL", month: monthFilter || "ALL" },
        planosAGerar: plans.length,
        sulJan: plans.filter((p) => p.region === "SUL" && p.month === 1).length,
      },
      null,
      2,
    ),
  );

  const c = new Client({
    connectionString:
      process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const regions = await c.query(`select id, code, name from core.regions`);
  const regionByCode = new Map(
    regions.rows.map((r) => [r.code, r as { id: string; code: string; name: string }]),
  );
  const units = await c.query(`
    select u.id, u.name, u.region_id, r.code as region_code
    from core.units u
    join core.regions r on r.id = u.region_id
    where u.deleted_at is null
  `);
  const unitByName = new Map(
    units.rows.map((u) => [norm(u.name), u as { id: string; name: string; region_id: string; region_code: string }]),
  );

  if (!apply) {
    const sulJan = plans.filter((p) => p.region === "SUL" && p.month === 1);
    let eleg = 0;
    let real = 0;
    let justAfast = 0;
    let justFerias = 0;
    for (const p of sulJan) {
      const elig = eligibilityFromFunctionalStatus(p.functional);
      if (elig.eligibility === "JUSTIFICADO") {
        if (elig.reason === "AFASTADO") justAfast += 1;
        if (elig.reason === "FERIAS") justFerias += 1;
        continue;
      }
      eleg += 1;
      if (p.performed) real += 1;
    }
    console.log("PREVIEW_SUL_JAN", {
      brutos: sulJan.length,
      elegiveis: eleg,
      realizados: real,
      pendentes: eleg - real,
      afastados: justAfast,
      ferias: justFerias,
    });
    console.log("(rode com --apply para gravar)");
    await c.end();
    return;
  }

  // Remove fisicamente soft-deletados do escopo (unique index ignora deleted_at)
  const hard = await c.query(
    `
    delete from occupational.aso_monthly_plans p
    where p.aso_type = 'PERIODICO'
      and p.year = 2026
      and coalesce(p.frozen,false) = false
      and p.deleted_at is not null
      and ($1::int is null or p.month = $1)
      and (
        $2::text is null
        or exists (
          select 1 from core.regions r
          where r.id = p.region_id and r.code = $2
        )
      )
    returning p.id
  `,
    [monthFilter, onlyRegion || null],
  );
  console.log("SOFT_DELETADOS_PURGADOS", hard.rowCount);

  // Soft-delete PERIODICO 2026 ativos no escopo (não congelados)
  const del = await c.query(
    `
    update occupational.aso_monthly_plans p
    set deleted_at = now(), updated_at = now()
    where p.deleted_at is null
      and p.aso_type = 'PERIODICO'
      and p.year = 2026
      and coalesce(p.frozen,false) = false
      and ($1::int is null or p.month = $1)
      and (
        $2::text is null
        or exists (
          select 1 from core.regions r
          where r.id = p.region_id and r.code = $2
        )
      )
    returning p.id
  `,
    [monthFilter, onlyRegion || null],
  );
  console.log("PLANOS_ANTIGOS_REMOVIDOS", del.rowCount);

  // Purge again after soft-delete so inserts don't collide
  const hard2 = await c.query(
    `
    delete from occupational.aso_monthly_plans p
    where p.aso_type = 'PERIODICO'
      and p.year = 2026
      and coalesce(p.frozen,false) = false
      and p.deleted_at is not null
      and ($1::int is null or p.month = $1)
      and (
        $2::text is null
        or exists (
          select 1 from core.regions r
          where r.id = p.region_id and r.code = $2
        )
      )
    returning p.id
  `,
    [monthFilter, onlyRegion || null],
  );
  console.log("PURGA_FINAL", hard2.rowCount);

  // Dedup: 1 plano por matrícula/mês
  const dedup = new Map<string, (typeof plans)[number]>();
  for (const p of plans) {
    dedup.set(`${p.reg}|${p.month}`, p);
  }
  const uniquePlans = [...dedup.values()];
  console.log("APOS_DEDUP", uniquePlans.length);

  let inserted = 0;
  let missingEmp = 0;
  for (const p of uniquePlans) {
    const emp = await c.query(
      `select id, registration, full_name, region_id, unit_id
       from core.employees
       where deleted_at is null
         and regexp_replace(registration, '^0+', '') = $1
       limit 1`,
      [p.reg],
    );
    if (!emp.rows[0]) {
      missingEmp += 1;
      continue;
    }
    const e = emp.rows[0];
    const reg = regionByCode.get(p.region);
    const unit = p.unit ? unitByName.get(norm(p.unit)) : null;
    const elig = eligibilityFromFunctionalStatus(p.functional);
    const realized = Boolean(p.performed) && elig.eligibility === "ELEGIVEL";
    const executionStatus = realized
      ? "REALIZADO"
      : elig.eligibility === "JUSTIFICADO"
        ? "JUSTIFICADO"
        : "PREVISTO";
    const eligibility =
      elig.eligibility === "JUSTIFICADO" ? "JUSTIFICADO" : "ELEGIVEL";

    await c.query(
      `
      insert into occupational.aso_monthly_plans (
        id, employee_id, registration, employee_name, aso_type, year, month,
        expected_date, region_id, unit_id, region_name_snapshot, unit_name_snapshot,
        functional_status_snapshot, prediction_origin, eligibility, justification_reason,
        execution_status, alterdata_status, frozen, created_at, updated_at
      ) values (
        gen_random_uuid(), $1, $2, $3, 'PERIODICO', 2026, $4,
        $5::date, $6, $7, $8, $9,
        $10, 'ASO_2026_CONTROL', $11, $12,
        $13, $14, false, now(), now()
      )
      on conflict (employee_id, aso_type, year, month) do update set
        deleted_at = null,
        expected_date = excluded.expected_date,
        region_id = excluded.region_id,
        unit_id = excluded.unit_id,
        region_name_snapshot = excluded.region_name_snapshot,
        unit_name_snapshot = excluded.unit_name_snapshot,
        functional_status_snapshot = excluded.functional_status_snapshot,
        prediction_origin = excluded.prediction_origin,
        eligibility = excluded.eligibility,
        justification_reason = excluded.justification_reason,
        execution_status = excluded.execution_status,
        alterdata_status = excluded.alterdata_status,
        updated_at = now()
    `,
      [
        e.id,
        e.registration,
        e.full_name || p.name,
        p.month,
        p.expected,
        unit?.region_id || reg?.id || e.region_id,
        unit?.id || e.unit_id,
        reg?.name || p.region,
        unit?.name || p.unit || null,
        p.functional,
        eligibility,
        elig.reason,
        executionStatus,
        realized ? "CONFIRMADO" : "NAO_APLICAVEL",
      ],
    );
    inserted += 1;
  }

  console.log({ inserted, missingEmp });

  const sul = await c.query(`
    select
      count(*)::int as brutos,
      count(*) filter (where eligibility = 'ELEGIVEL')::int as elegiveis,
      count(*) filter (
        where eligibility = 'ELEGIVEL' and execution_status = 'REALIZADO'
      )::int as realizados,
      count(*) filter (
        where eligibility = 'ELEGIVEL' and execution_status <> 'REALIZADO'
      )::int as pendentes,
      count(*) filter (where justification_reason = 'AFASTADO')::int as afastados,
      count(*) filter (where justification_reason = 'FERIAS')::int as ferias
    from occupational.aso_monthly_plans p
    join core.regions r on r.id = p.region_id
    where p.deleted_at is null and p.aso_type='PERIODICO'
      and p.year=2026 and p.month=1 and r.code='SUL'
  `);
  console.log("SUL_JAN_APOS", sul.rows[0]);

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
