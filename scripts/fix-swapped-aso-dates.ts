/**
 * Corrige datas de ASO invertidas (bug DD/MM lido como MM/DD) a partir da
 * aba ALTERDATA da Planilha Sistema Saúde (seriais Excel confiáveis).
 *
 * Uso: npx tsx scripts/fix-swapped-aso-dates.ts [--dry]
 */
import { config } from "dotenv";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { Client } from "pg";

config({ path: resolve(process.cwd(), ".env.local") });

function normalizeText(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cell(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const found = Object.keys(row).find(
      (k) => normalizeText(k) === normalizeText(key),
    );
    if (found && row[found] != null && String(row[found]).trim() !== "") {
      return row[found];
    }
  }
  return "";
}

function excelDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    if (value < 20000 || value > 60000) return null;
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const raw = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(raw)) return excelDate(Number(raw));
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

function regKeys(registration: string): string[] {
  const raw = String(registration).trim();
  const digits = raw.replace(/\D/g, "");
  const unpadded = digits.replace(/^0+/, "") || "0";
  const keys = new Set<string>([raw]);
  if (digits) {
    keys.add(digits);
    keys.add(unpadded);
    for (const pad of [5, 6, 7, 8]) {
      keys.add(unpadded.padStart(pad, "0"));
      keys.add(digits.padStart(pad, "0"));
    }
  }
  return [...keys];
}

function isDateSwap(a: string, b: string): boolean {
  if (a.slice(0, 4) !== b.slice(0, 4)) return false;
  return a.slice(5, 7) === b.slice(8, 10) && a.slice(8, 10) === b.slice(5, 7);
}

async function main() {
  const dry = process.argv.includes("--dry");
  const file =
    readdirSync(process.cwd()).find((f) =>
      /^Planilha Sistema.*\.xlsx$/i.test(f),
    ) || "Planilha Sistema Saúde.xlsx";
  if (!existsSync(file)) throw new Error(`Arquivo não encontrado: ${file}`);

  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  console.time("total");
  const wb = XLSX.readFile(file);
  const sheet = wb.Sheets["ALTERDATA"];
  if (!sheet) throw new Error("Aba ALTERDATA não encontrada");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  console.log("Linhas ALTERDATA:", rows.length);

  const c = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const emps = await c.query<{ id: string; registration: string }>(
    `select id, registration from core.employees where deleted_at is null`,
  );
  const byReg = new Map<string, { id: string; registration: string }>();
  for (const e of emps.rows) {
    for (const k of regKeys(e.registration)) byReg.set(k, e);
  }

  const snaps = await c.query<{
    employee_id: string;
    next_aso_date: string | null;
    last_aso_date: string | null;
  }>(`
    select distinct on (employee_id)
      employee_id, next_aso_date::text, last_aso_date::text
    from occupational.aso_alterdata_snapshots
    order by employee_id, synced_at desc
  `);
  const snapByEmp = new Map(snaps.rows.map((s) => [s.employee_id, s]));

  const plans = await c.query<{
    id: string;
    employee_id: string;
    year: number;
    month: number;
    expected_date: string | null;
    execution_status: string;
  }>(`
    select id, employee_id, year, month, expected_date::text, execution_status
    from occupational.aso_monthly_plans
    where deleted_at is null
      and aso_type = 'PERIODICO'
      and execution_status in ('PREVISTO','AGENDADO','VENCIDO','NAO_REALIZADO','REPROGRAMADO')
  `);
  const plansByEmp = new Map<string, typeof plans.rows>();
  for (const p of plans.rows) {
    const list = plansByEmp.get(p.employee_id) ?? [];
    list.push(p);
    plansByEmp.set(p.employee_id, list);
  }

  type SnapIns = {
    employeeId: string;
    registration: string;
    next: string | null;
    last: string | null;
    status: string | null;
    period: number;
  };
  type PlanUpd = {
    id: string;
    next: string;
    year: number;
    month: number;
    softDelete: boolean;
  };

  const snapInserts: SnapIns[] = [];
  const planUpdates: PlanUpd[] = [];
  let checked = 0;
  let andre: Record<string, unknown> | null = null;

  for (const row of rows) {
    const regRaw = cell(row, "CdChamada", "Matrícula", "Funcionário");
    const reg = String(regRaw ?? "").trim();
    if (!reg) continue;
    const emp =
      byReg.get(reg) ||
      byReg.get(reg.replace(/\D/g, "")) ||
      byReg.get(reg.replace(/\D/g, "").replace(/^0+/, "") || "0");
    if (!emp) continue;

    const next = excelDate(
      cell(row, "Proximo_aso", "Próximo ASO", "Data Proximo ASO"),
    );
    const last = excelDate(
      cell(row, "Data_Atestado", "Data Atestado", "Data_Atestado_(2026)"),
    );
    if (!next && !last) continue;
    checked += 1;

    const snap = snapByEmp.get(emp.id);
    const nextWrong = Boolean(next && snap?.next_aso_date && snap.next_aso_date !== next);
    const lastWrong = Boolean(last && snap?.last_aso_date && snap.last_aso_date !== last);
    // Também corrige se não há snapshot mas há plano com data trocada
    const open = plansByEmp.get(emp.id) ?? [];

    if (snap && (nextWrong || lastWrong)) {
      snapInserts.push({
        employeeId: emp.id,
        registration: emp.registration,
        next: next ?? snap.next_aso_date,
        last: last ?? snap.last_aso_date,
        status: String(cell(row, "Status_ASO", "Status ASO") || "") || null,
        period: Number(cell(row, "Periodicidade")) || 12,
      });
    }

    if (next) {
      const y = Number(next.slice(0, 4));
      const m = Number(next.slice(5, 7));
      const hasCorrect = open.some(
        (p) => p.year === y && p.month === m && p.expected_date === next,
      );
      for (const p of open) {
        if (p.expected_date === next && p.year === y && p.month === m) continue;
        const looksSwapped =
          p.expected_date != null && isDateSwap(p.expected_date, next);
        const matchesBadSnap =
          snap != null &&
          p.expected_date != null &&
          p.expected_date === snap.next_aso_date &&
          snap.next_aso_date !== next;
        if (!looksSwapped && !matchesBadSnap) continue;
        planUpdates.push({
          id: p.id,
          next,
          year: y,
          month: m,
          softDelete: hasCorrect,
        });
      }
    }

    const name = String(cell(row, "NmFuncionario") || "");
    if (normalizeText(name).includes("ANDRE SILVA COSTA")) {
      andre = {
        reg: emp.registration,
        next,
        last,
        snapNext: snap?.next_aso_date,
        open: open.map((p) => ({
          id: p.id,
          expected: p.expected_date,
          y: p.year,
          m: p.month,
        })),
      };
    }
  }

  console.log(
    JSON.stringify(
      {
        dry,
        checked,
        snapshotFixed: snapInserts.length,
        planFixed: planUpdates.length,
        andre,
      },
      null,
      2,
    ),
  );

  if (!dry) {
    await c.query("begin");
    try {
      // Snapshots em lote
      for (let i = 0; i < snapInserts.length; i += 100) {
        const chunk = snapInserts.slice(i, i + 100);
        const values: unknown[] = [];
        const ph: string[] = [];
        let p = 1;
        for (const s of chunk) {
          ph.push(
            `($${p++},$${p++},$${p++}::date,$${p++}::date,$${p++},$${p++},now(),'FIX_SWAPPED_DATES:Planilha')`,
          );
          values.push(
            s.employeeId,
            s.registration,
            s.next,
            s.last,
            s.status,
            s.period,
          );
        }
        await c.query(
          `insert into occupational.aso_alterdata_snapshots
            (employee_id, registration, next_aso_date, last_aso_date,
             status_aso, periodicity_months, synced_at, source_ref)
           values ${ph.join(",")}`,
          values,
        );
      }

      for (const p of planUpdates) {
        // Garante slot no mês correto (inclusive se houver linha soft-deleted)
        await c.query(
          `update occupational.aso_monthly_plans
           set deleted_at = now(), updated_at = now()
           where id = $1`,
          [p.id],
        );

        const existing = await c.query<{ id: string }>(
          `select id from occupational.aso_monthly_plans
           where employee_id = (
               select employee_id from occupational.aso_monthly_plans where id = $1
             )
             and aso_type = 'PERIODICO'
             and year = $2 and month = $3
           limit 1`,
          [p.id, p.year, p.month],
        );

        // Recupera employee_id do plano
        const empRow = await c.query<{ employee_id: string; registration: string; employee_name: string; region_id: string | null; unit_id: string | null; region_name_snapshot: string | null; unit_name_snapshot: string | null; functional_status_snapshot: string | null }>(
          `select employee_id, registration, employee_name, region_id, unit_id,
                  region_name_snapshot, unit_name_snapshot, functional_status_snapshot
           from occupational.aso_monthly_plans where id = $1`,
          [p.id],
        );
        const meta = empRow.rows[0];
        if (!meta) continue;

        if (existing.rows[0]) {
          await c.query(
            `update occupational.aso_monthly_plans
             set expected_date = $2::date,
                 execution_status = 'PREVISTO',
                 alterdata_status = 'NAO_APLICAVEL',
                 eligibility = 'ELEGIVEL',
                 justification_reason = null,
                 deleted_at = null,
                 updated_at = now()
             where id = $1`,
            [existing.rows[0].id, p.next],
          );
        } else {
          await c.query(
            `insert into occupational.aso_monthly_plans
              (employee_id, registration, employee_name, aso_type, year, month,
               expected_date, region_id, unit_id, region_name_snapshot,
               unit_name_snapshot, functional_status_snapshot, prediction_origin,
               eligibility, execution_status, alterdata_status)
             values ($1,$2,$3,'PERIODICO',$4,$5,$6::date,$7,$8,$9,$10,$11,
                     'ALTERDATA_NEXT_ASO','ELEGIVEL','PREVISTO','NAO_APLICAVEL')`,
            [
              meta.employee_id,
              meta.registration,
              meta.employee_name,
              p.year,
              p.month,
              p.next,
              meta.region_id,
              meta.unit_id,
              meta.region_name_snapshot,
              meta.unit_name_snapshot,
              meta.functional_status_snapshot,
            ],
          );
        }
      }
      await c.query("commit");
      console.log("APPLIED ok");
    } catch (e) {
      await c.query("rollback");
      throw e;
    }
  }

  if (andre) {
    const empId = byReg.get(String(andre.reg))?.id;
    if (empId) {
      const check = await c.query(
        `select expected_date::text, year, month, execution_status
         from occupational.aso_monthly_plans
         where employee_id = $1 and deleted_at is null
         order by year, month`,
        [empId],
      );
      const snap = await c.query(
        `select next_aso_date::text, last_aso_date::text, source_ref, synced_at
         from occupational.aso_alterdata_snapshots
         where employee_id = $1
         order by synced_at desc limit 2`,
        [empId],
      );
      console.log("ANDRE_PLANS", check.rows);
      console.log("ANDRE_SNAPS", snap.rows);
    }
  }

  await c.end();
  console.timeEnd("total");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
