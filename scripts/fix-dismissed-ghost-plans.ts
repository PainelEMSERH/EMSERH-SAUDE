/**
 * 1) Corrige DtDemissao a partir da planilha (parseSheetDate)
 * 2) Remove planos 2026 de quem já estava demitido antes de 2026-01-01
 *
 * Uso: npx tsx scripts/fix-dismissed-ghost-plans.ts --apply
 */
import { config } from "dotenv";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { Client } from "pg";
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
  const year = 2026;
  const yearStart = `${year}-01-01`;

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

  const sheetDem = new Map<string, string>();
  for (const row of alt) {
    const reg = regKey(cell(row, "CdChamada", "Matrícula"));
    const dem = parseSheetDate(cell(row, "DtDemissao") as string | number);
    if (reg && dem) sheetDem.set(reg, dem);
  }

  const c = new Client({
    connectionString:
      process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  // Preview date mismatches
  let dateMismatch = 0;
  for (const [reg, sheetDate] of sheetDem) {
    const emp = await c.query(
      `select registration, full_name, dismissal_date::text as dem
       from core.employees
       where deleted_at is null
         and regexp_replace(registration, '^0+', '') = $1
       limit 1`,
      [reg],
    );
    if (!emp.rows[0]) continue;
    if (emp.rows[0].dem !== sheetDate) {
      dateMismatch += 1;
      if (dateMismatch <= 15) {
        console.log(
          `DATA ${emp.rows[0].registration} | ${emp.rows[0].full_name} | db=${emp.rows[0].dem} sheet=${sheetDate}`,
        );
      }
    }
  }
  console.log(`Datas de demissão divergentes: ${dateMismatch}`);

  const ghosts = await c.query(
    `
    select count(*)::int as n,
           count(*) filter (where p.aso_type='PERIODICO')::int as periodicos,
           count(*) filter (where p.aso_type='DEMISSIONAL')::int as demissionais,
           count(*) filter (
             where p.aso_type='PERIODICO' and p.month=1
               and r.code='SUL'
           )::int as sul_jan_periodico
    from occupational.aso_monthly_plans p
    join core.employees e on e.id = p.employee_id
    left join core.regions r on r.id = p.region_id
    where p.deleted_at is null
      and p.year = $1
      and e.dismissal_date is not null
      and e.dismissal_date < $2::date
  `,
    [year, yearStart],
  );
  console.log("FANTASMAS_COM_DATA_ATUAL_DB", ghosts.rows[0]);

  if (!apply) {
    console.log("\n(rode com --apply para gravar)");
    await c.end();
    return;
  }

  // 1) Corrige datas de demissão pela planilha
  let datesFixed = 0;
  for (const [reg, sheetDate] of sheetDem) {
    const upd = await c.query(
      `update core.employees
       set dismissal_date = $2::date,
           functional_status = 'DEMITIDO',
           updated_at = now()
       where deleted_at is null
         and regexp_replace(registration, '^0+', '') = $1
         and (
           dismissal_date is distinct from $2::date
           or coalesce(functional_status,'') <> 'DEMITIDO'
         )
       returning registration`,
      [reg, sheetDate],
    );
    datesFixed += upd.rowCount || 0;
  }
  console.log(`Datas/status demissão corrigidos: ${datesFixed}`);

  // 2) Soft-delete todos os planos do ano para demitidos antes do ano
  const del = await c.query(
    `
    update occupational.aso_monthly_plans p
    set deleted_at = now(), updated_at = now()
    from core.employees e
    where e.id = p.employee_id
      and p.deleted_at is null
      and e.deleted_at is null
      and p.year = $1
      and coalesce(p.frozen, false) = false
      and e.dismissal_date is not null
      and e.dismissal_date < $2::date
    returning p.registration, p.aso_type, p.month, p.employee_name
  `,
    [year, yearStart],
  );
  console.log(`Planos fantasma removidos: ${del.rowCount}`);

  // Cassiana check + Sul jan
  const cassiana = await c.query(`
    select e.registration, e.full_name, e.dismissal_date::text,
           (select count(*) from occupational.aso_monthly_plans p
             where p.employee_id = e.id and p.deleted_at is null and p.year=2026) as planos_2026
    from core.employees e
    where regexp_replace(e.registration, '^0+', '') = '964'
  `);
  console.log("CASSIANA", cassiana.rows[0]);

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
      count(*) filter (where justification_reason = 'DEMITIDO')::int as demitidos_just
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
