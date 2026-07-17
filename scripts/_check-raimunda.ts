import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const REG = "003695";

async function main() {
  const emp = await sql`
    select id, registration, full_name,
           admission_date::date as admission,
           dismissal_date::date as dismissal,
           functional_status
    from core.employees where registration = ${REG}`;
  console.log("EMP", JSON.stringify(emp, null, 2));
  if (!emp.length) return;
  const id = emp[0].id;

  const snaps = await sql`
    select next_aso_date::date as next_aso, last_aso_date::date as last_aso,
           status_aso, periodicity_months, synced_at, source_ref
    from occupational.aso_alterdata_snapshots
    where registration = ${REG}
    order by synced_at desc limit 5`;
  console.log("SNAPS", JSON.stringify(snaps, null, 2));

  const plans = await sql`
    select aso_type, year, month, expected_date::date as expected,
           eligibility, execution_status, alterdata_status,
           prediction_origin, aso_record_id, deleted_at
    from occupational.aso_monthly_plans
    where employee_id = ${id}
    order by deleted_at nulls first, year, month, aso_type`;
  console.log("PLANS", JSON.stringify(plans, null, 2));

  const records = await sql`
    select aso_type, performed_date::date as performed,
           last_aso_date::date as last_aso, next_aso_date::date as next_aso,
           origin, plan_id
    from occupational.aso_records
    where employee_id = ${id} and deleted_at is null
    order by coalesce(performed_date, last_aso_date) desc nulls last`;
  console.log("RECORDS", JSON.stringify(records, null, 2));

  // Quantos periódicos out/2026 REALIZADO com last_aso em outro mês
  const weird = await sql`
    select count(*)::int as total,
           count(*) filter (
             where s.last_aso_date is not null
               and extract(month from s.last_aso_date) <> 10
           )::int as last_aso_outro_mes,
           count(*) filter (
             where s.last_aso_date is not null
               and extract(year from s.last_aso_date) = 2026
               and extract(month from s.last_aso_date) between 1 and 7
               and p.execution_status = 'REALIZADO'
           )::int as realizado_com_atestado_jan_jul
    from occupational.aso_monthly_plans p
    left join lateral (
      select last_aso_date, next_aso_date from occupational.aso_alterdata_snapshots s
      where s.registration = p.registration
      order by synced_at desc limit 1
    ) s on true
    where p.deleted_at is null
      and p.aso_type = 'PERIODICO'
      and p.year = 2026 and p.month = 10`;
  console.log("OUT_2026_WEIRD", JSON.stringify(weird[0], null, 2));

  // Sample of out/2026 realizados with early last_aso
  const sample = await sql`
    select p.registration, p.employee_name, p.expected_date::date as expected,
           p.execution_status, p.prediction_origin,
           s.last_aso_date::date as last_aso, s.next_aso_date::date as next_aso
    from occupational.aso_monthly_plans p
    left join lateral (
      select last_aso_date, next_aso_date from occupational.aso_alterdata_snapshots s
      where s.registration = p.registration
      order by synced_at desc limit 1
    ) s on true
    where p.deleted_at is null
      and p.aso_type = 'PERIODICO'
      and p.year = 2026 and p.month = 10
      and p.execution_status = 'REALIZADO'
      and s.last_aso_date is not null
      and extract(month from s.last_aso_date) <> 10
    order by p.employee_name
    limit 25`;
  console.log("SAMPLE_REALIZADO_WRONG", JSON.stringify(sample, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
