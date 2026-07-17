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

  const cassiana = await c.query(`
    select e.registration, e.full_name, e.functional_status,
           e.admission_date::text, e.dismissal_date::text,
           p.aso_type, p.year, p.month, p.expected_date::text,
           p.eligibility, p.execution_status, p.justification_reason,
           p.prediction_origin, p.functional_status_snapshot
    from core.employees e
    left join occupational.aso_monthly_plans p
      on p.employee_id = e.id and p.deleted_at is null and p.year = 2026
    where e.deleted_at is null
      and regexp_replace(e.registration, '^0+', '') = '964'
    order by p.aso_type, p.month
  `);
  console.log("CASSIANA", JSON.stringify(cassiana.rows, null, 2));

  // Demitidos antes de 2026 ainda com plano PERIODICO 2026
  const ghost = await c.query(`
    select
      count(*)::int as planos,
      count(distinct e.id)::int as pessoas,
      count(*) filter (where p.month = 1 and r.code = 'SUL')::int as sul_jan
    from occupational.aso_monthly_plans p
    join core.employees e on e.id = p.employee_id
    left join core.regions r on r.id = p.region_id
    where p.deleted_at is null
      and e.deleted_at is null
      and p.aso_type = 'PERIODICO'
      and p.year = 2026
      and e.dismissal_date is not null
      and e.dismissal_date < date '2026-01-01'
  `);
  console.log("GHOST_PERIODICO_2026_DEMITIDOS_ANTES", ghost.rows[0]);

  const sample = await c.query(`
    select e.registration, e.full_name, e.dismissal_date::text,
           p.month, p.eligibility, p.justification_reason, p.prediction_origin,
           r.code as region
    from occupational.aso_monthly_plans p
    join core.employees e on e.id = p.employee_id
    left join core.regions r on r.id = p.region_id
    where p.deleted_at is null
      and p.aso_type = 'PERIODICO'
      and p.year = 2026
      and e.dismissal_date is not null
      and e.dismissal_date < date '2026-01-01'
    order by e.dismissal_date, e.full_name
    limit 25
  `);
  console.log("AMOSTRA");
  for (const r of sample.rows) {
    console.log(
      `${r.registration} | ${r.full_name} | dem ${r.dismissal_date} | mês ${r.month} | ${r.region} | ${r.justification_reason || r.eligibility} | ${r.prediction_origin}`,
    );
  }

  // Demissional 2026 para quem demitiu em 2025
  const demWrongYear = await c.query(`
    select count(*)::int as n
    from occupational.aso_monthly_plans p
    join core.employees e on e.id = p.employee_id
    where p.deleted_at is null
      and p.aso_type = 'DEMISSIONAL'
      and p.year = 2026
      and e.dismissal_date is not null
      and e.dismissal_date < date '2026-01-01'
  `);
  console.log("DEMISSIONAL_2026_COM_DEMISSAO_2025", demWrongYear.rows[0]);

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
