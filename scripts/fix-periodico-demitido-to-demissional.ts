import { config } from "dotenv";
import { resolve } from "node:path";
import { Client } from "pg";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const c = new Client({
    connectionString:
      process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const del = await c.query(`
    update occupational.aso_monthly_plans p
    set deleted_at = now(), updated_at = now()
    where p.deleted_at is null
      and p.aso_type = 'PERIODICO'
      and p.year = 2026
      and coalesce(p.frozen,false) = false
      and p.justification_reason = 'DEMITIDO'
    returning p.registration, p.employee_name, p.month
  `);
  console.log("PERIODICO_DEMITIDO_REMOVIDOS", del.rowCount);

  const missing = await c.query(`
    insert into occupational.aso_monthly_plans (
      id, employee_id, registration, employee_name, aso_type, year, month,
      expected_date, region_id, unit_id, region_name_snapshot, unit_name_snapshot,
      functional_status_snapshot, prediction_origin, eligibility, justification_reason,
      execution_status, alterdata_status, frozen, created_at, updated_at
    )
    select
      gen_random_uuid(), e.id, e.registration, e.full_name, 'DEMISSIONAL',
      extract(year from e.dismissal_date)::int,
      extract(month from e.dismissal_date)::int,
      e.dismissal_date, e.region_id, e.unit_id, r.name, u.name,
      'DEMITIDO', 'DISMISSAL', 'ELEGIVEL', null,
      'PREVISTO', 'NAO_APLICAVEL', false, now(), now()
    from core.employees e
    left join core.regions r on r.id = e.region_id
    left join core.units u on u.id = e.unit_id
    where e.deleted_at is null
      and e.dismissal_date is not null
      and e.dismissal_date >= date '2026-01-01'
      and e.dismissal_date < date '2027-01-01'
      and not exists (
        select 1 from occupational.aso_monthly_plans p
        where p.employee_id = e.id and p.deleted_at is null
          and p.aso_type = 'DEMISSIONAL' and p.year = 2026
          and p.month = extract(month from e.dismissal_date)::int
      )
    returning registration, employee_name, month
  `);
  console.log("DEMISSIONAL_CRIADOS", missing.rowCount);

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
