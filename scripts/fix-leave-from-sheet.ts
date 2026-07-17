/**
 * Backfill: Início/Fim Afastamento da planilha → functional_status + planos JUSTIFICADO
 *
 * Uso: npx tsx scripts/fix-leave-from-sheet.ts --apply
 */
import { config } from "dotenv";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { Client } from "pg";
import { mapAlterdataFunctionalStatus } from "../src/lib/employees/alterdata-status";
import { parseSheetDate } from "../src/lib/dates";

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

function regKey(v: unknown): string {
  const digits = String(v ?? "").replace(/\D/g, "");
  return digits.replace(/^0+/, "") || "0";
}

async function main() {
  const apply = process.argv.includes("--apply");
  const today = new Date().toISOString().slice(0, 10);
  const file =
    readdirSync(process.cwd()).find((f) =>
      /^Planilha Sistema.*\.xlsx$/i.test(f),
    ) || "Planilha Sistema Saúde.xlsx";
  if (!existsSync(file)) throw new Error("Planilha não encontrada");

  const wb = XLSX.readFile(file);
  const alt = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets["ALTERDATA"],
    { defval: "" },
  );

  type LeaveRow = {
    reg: string;
    name: string;
    mapped: string;
    start: string | null;
    end: string | null;
  };

  const leaveRows: LeaveRow[] = [];
  for (const row of alt) {
    const reg = regKey(cell(row, "CdChamada", "Matrícula"));
    if (!reg || reg === "0") continue;
    const name = String(cell(row, "NmFuncionario", "Nome") || "");
    const leaveStartRaw = cell(
      row,
      "Início Afastamento",
      "Inicio Afastamento",
    );
    const leaveEndRaw = cell(row, "Fim Afastamento");
    const mapped = mapAlterdataFunctionalStatus({
      dismissalRaw: String(cell(row, "DtDemissao") || ""),
      statusAso: String(cell(row, "Status_ASO") || ""),
      afastamentoRaw: "",
      statusFerias: String(cell(row, "Status_Ferias", "Ferias") || ""),
      leaveStartRaw,
      leaveEndRaw,
      todayIso: today,
    });
    if (mapped !== "AFASTADO" && mapped !== "FERIAS") continue;
    leaveRows.push({
      reg,
      name,
      mapped,
      start: parseSheetDate(leaveStartRaw as string | number),
      end: parseSheetDate(leaveEndRaw as string | number),
    });
  }

  console.log(
    JSON.stringify(
      {
        today,
        leaveAtivosNaPlanilha: leaveRows.length,
        afastados: leaveRows.filter((r) => r.mapped === "AFASTADO").length,
        ferias: leaveRows.filter((r) => r.mapped === "FERIAS").length,
        amostra: leaveRows.slice(0, 8),
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

  if (!apply) {
    // Preview who would change among elegíveis
    let wouldFixPlans = 0;
    for (const s of leaveRows) {
      const q = await c.query(
        `select p.registration, p.employee_name, p.month, p.execution_status, e.functional_status
         from occupational.aso_monthly_plans p
         join core.employees e on e.id = p.employee_id
         where p.deleted_at is null and e.deleted_at is null
           and p.aso_type='PERIODICO' and p.year=2026
           and p.eligibility='ELEGIVEL'
           and p.execution_status <> 'REALIZADO'
           and regexp_replace(e.registration, '^0+', '') = $1`,
        [s.reg],
      );
      wouldFixPlans += q.rowCount || 0;
      for (const r of q.rows) {
        console.log(
          `PREVIEW ${r.registration} | ${r.employee_name} | mês ${r.month} | ${r.execution_status} | emp=${r.functional_status} → ${s.mapped}`,
        );
      }
    }
    console.log(`\nPlanos elegíveis não-realizados a justificar: ${wouldFixPlans}`);
    console.log("(rode com --apply para gravar)");
    await c.end();
    return;
  }

  let empUpd = 0;
  let planUpd = 0;
  const touched: string[] = [];

  for (const s of leaveRows) {
    const emp = await c.query(
      `update core.employees
       set functional_status = $2, updated_at = now()
       where deleted_at is null
         and regexp_replace(registration, '^0+', '') = $1
       returning registration, full_name, functional_status`,
      [s.reg, s.mapped],
    );
    if ((emp.rowCount || 0) > 0) empUpd += 1;

    const plans = await c.query(
      `update occupational.aso_monthly_plans p
       set
         eligibility = 'JUSTIFICADO',
         execution_status = 'JUSTIFICADO',
         justification_reason = $2,
         functional_status_snapshot = $2,
         justified_at = coalesce(p.justified_at, now()),
         updated_at = now()
       from core.employees e
       where e.id = p.employee_id
         and e.deleted_at is null
         and p.deleted_at is null
         and regexp_replace(e.registration, '^0+', '') = $1
         and p.aso_type = 'PERIODICO'
         and p.year = 2026
         and p.eligibility = 'ELEGIVEL'
         and p.execution_status <> 'REALIZADO'
         and coalesce(p.frozen, false) = false
       returning p.registration, p.employee_name, p.month, p.justification_reason`,
      [s.reg, s.mapped],
    );
    for (const r of plans.rows) {
      planUpd += 1;
      touched.push(
        `${r.registration} | ${r.employee_name} | mês ${r.month} | ${r.justification_reason}`,
      );
    }
  }

  console.log(`\nEmployees atualizados: ${empUpd}`);
  console.log(`Planos justificados: ${planUpd}`);
  for (const t of touched) console.log(`OK ${t}`);

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
      count(*) filter (where justification_reason = 'FERIAS')::int as ferias,
      count(*) filter (where justification_reason = 'DEMITIDO')::int as demitidos
    from occupational.aso_monthly_plans p
    join core.regions r on r.id = p.region_id
    where p.deleted_at is null and p.aso_type='PERIODICO'
      and p.year=2026 and p.month=1 and r.code='SUL'
  `);
  console.log("\nSUL_JAN_APOS", sul.rows[0]);

  const raimundo = await c.query(`
    select e.registration, e.full_name, e.functional_status,
           p.eligibility, p.execution_status, p.justification_reason
    from core.employees e
    left join occupational.aso_monthly_plans p
      on p.employee_id = e.id and p.deleted_at is null
     and p.aso_type='PERIODICO' and p.year=2026 and p.month=1
    where regexp_replace(e.registration, '^0+', '') = '9334'
  `);
  console.log("RAIMUNDO_APOS", raimundo.rows[0]);

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
