/**
 * Rebuild rápido em lote a partir da ASO 2026.
 * npx tsx scripts/rebuild-plans-from-aso2026-fast.ts --apply
 */
import { config } from "dotenv";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { Client } from "pg";
import { parseSheetDate } from "../src/lib/dates";
import { functionalStatusForCompetence } from "../src/lib/employees/alterdata-status";
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

async function main() {
  const apply = process.argv.includes("--apply");
  const file =
    readdirSync(".").find((f) => /^Planilha Sistema.*\.xlsx$/i.test(f))!;
  if (!existsSync(file)) throw new Error("Planilha não encontrada");

  const wb = XLSX.readFile(file);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets["ASO 2026"],
    { defval: "" },
  );

  type P = {
    reg: string;
    name: string;
    month: number;
    expected: string;
    performed: string | null;
    region: string;
    unit: string;
    functional: string;
  };
  const map = new Map<string, P>();

  for (const row of rows) {
    const tipo = String(cell(row, "Tipo Proximo ASO") || "");
    if (!norm(tipo).includes("PERIOD")) continue;
    const month = Number(cell(row, "Mês", "Mes"));
    if (!Number.isFinite(month) || month < 1 || month > 12) continue;
    const demissao = parseSheetDate(
      cell(row, "Demissão") as string | number,
    );
    if (demissao && demissao < "2026-01-01") continue;
    if (
      demissao &&
      demissao.startsWith(`2026-${String(month).padStart(2, "0")}`)
    ) {
      continue;
    }
    if (demissao && demissao < `2026-${String(month).padStart(2, "0")}-01`) {
      continue;
    }

    const functional = functionalStatusForCompetence({
      dismissalRaw: demissao || "",
      feriasStartRaw: cell(row, "Data Inicio Férias") as string | number,
      feriasEndRaw: cell(row, "Data Fim Férias") as string | number,
      leaveStartRaw: cell(row, "Início Afastamento") as string | number,
      leaveEndRaw: cell(row, "Fim Afastamento") as string | number,
      year: 2026,
      month,
    });

    const reg = regKey(cell(row, "Funcionário"));
    const expected =
      parseSheetDate(cell(row, "Data Proximo ASO") as string | number) ||
      `2026-${String(month).padStart(2, "0")}-15`;
    map.set(`${reg}|${month}`, {
      reg,
      name: String(cell(row, "Nome do Funcionário") || "").trim(),
      month,
      expected,
      performed: parseSheetDate(
        cell(row, "Data_Atestado_(2026)") as string | number,
      ),
      region: regionCode(String(cell(row, "Regional") || "")),
      unit: String(cell(row, "Departamento") || ""),
      functional,
    });
  }

  const plans = [...map.values()];
  console.log("PLANOS", plans.length, "SUL_JAN", plans.filter((p) => p.region === "SUL" && p.month === 1).length);

  if (!apply) {
    console.log("dry-run");
    return;
  }

  const c = new Client({
    connectionString:
      process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  await c.query(`
    delete from occupational.aso_monthly_plans
    where aso_type = 'PERIODICO' and year = 2026 and coalesce(frozen,false)=false
  `);
  console.log("cleared periodico 2026");

  const emps = await c.query(`
    select id, registration, full_name, region_id, unit_id,
           regexp_replace(registration, '^0+', '') as reg
    from core.employees where deleted_at is null
  `);
  const empByReg = new Map(emps.rows.map((e) => [e.reg, e]));

  const regions = await c.query(`select id, code, name from core.regions`);
  const regionByCode = new Map(regions.rows.map((r) => [r.code, r]));

  const units = await c.query(`
    select u.id, u.name, u.region_id from core.units u where u.deleted_at is null
  `);
  const unitByName = new Map(units.rows.map((u) => [norm(u.name), u]));

  const values: unknown[] = [];
  const placeholders: string[] = [];
  let i = 1;
  let missing = 0;

  for (const p of plans) {
    const e = empByReg.get(p.reg);
    if (!e) {
      missing += 1;
      continue;
    }
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

    placeholders.push(
      `(gen_random_uuid(),$${i++},$${i++},$${i++},'PERIODICO',2026,$${i++},$${i++}::date,$${i++},$${i++},$${i++},$${i++},$${i++},'ASO_2026_CONTROL',$${i++},$${i++},$${i++},$${i++},false,now(),now())`,
    );
    values.push(
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
    );
  }

  const chunk = 200;
  let inserted = 0;
  for (let start = 0; start < placeholders.length; start += chunk) {
    const ph = placeholders.slice(start, start + chunk);
    const sliceVals = values.slice(start * 14, (start + chunk) * 14);
    // recalculate value slice properly
  }

  // Rebuild placeholders in chunks with correct value indexing
  for (let start = 0; start < plans.length; start += chunk) {
    const slice = plans.slice(start, start + chunk);
    const ph: string[] = [];
    const vals: unknown[] = [];
    let n = 1;
    for (const p of slice) {
      const e = empByReg.get(p.reg);
      if (!e) continue;
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
      ph.push(
        `(gen_random_uuid(),$${n++},$${n++},$${n++},'PERIODICO',2026,$${n++},$${n++}::date,$${n++},$${n++},$${n++},$${n++},$${n++},'ASO_2026_CONTROL',$${n++},$${n++},$${n++},$${n++},false,now(),now())`,
      );
      vals.push(
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
      );
    }
    if (!ph.length) continue;
    await c.query(
      `insert into occupational.aso_monthly_plans (
        id, employee_id, registration, employee_name, aso_type, year, month,
        expected_date, region_id, unit_id, region_name_snapshot, unit_name_snapshot,
        functional_status_snapshot, prediction_origin, eligibility, justification_reason,
        execution_status, alterdata_status, frozen, created_at, updated_at
      ) values ${ph.join(",")}`,
      vals,
    );
    inserted += ph.length;
    console.log(`chunk ${start}+ → ${inserted}`);
  }

  console.log({ inserted, missing });

  const sul = await c.query(`
    select
      count(*)::int as brutos,
      count(*) filter (where eligibility = 'ELEGIVEL')::int as elegiveis,
      count(*) filter (where eligibility = 'ELEGIVEL' and execution_status = 'REALIZADO')::int as realizados,
      count(*) filter (where eligibility = 'ELEGIVEL' and execution_status <> 'REALIZADO')::int as pendentes,
      count(*) filter (where justification_reason = 'AFASTADO')::int as afastados,
      count(*) filter (where justification_reason = 'FERIAS')::int as ferias
    from occupational.aso_monthly_plans p
    join core.regions r on r.id = p.region_id
    where p.deleted_at is null and p.aso_type='PERIODICO'
      and p.year=2026 and p.month=1 and r.code='SUL'
  `);
  console.log("SUL_JAN", sul.rows[0]);
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
