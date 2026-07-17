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

  const rows = await c.query(`
    select p.registration, p.employee_name, p.justification_reason,
           p.eligibility, p.execution_status, e.dismissal_date::text,
           e.functional_status
    from occupational.aso_monthly_plans p
    join core.regions r on r.id = p.region_id
    join core.employees e on e.id = p.employee_id
    where p.deleted_at is null
      and p.aso_type = 'PERIODICO'
      and p.year = 2026 and p.month = 1
      and r.code = 'SUL'
      and p.justification_reason = 'DEMITIDO'
  `);
  console.log(JSON.stringify(rows.rows, null, 2));

  const just = await c.query(`
    select justification_reason, count(*)::int n
    from occupational.aso_monthly_plans p
    join core.regions r on r.id = p.region_id
    where p.deleted_at is null
      and p.aso_type = 'PERIODICO'
      and p.year = 2026 and p.month = 1
      and r.code = 'SUL'
      and p.eligibility <> 'ELEGIVEL'
    group by 1
  `);
  console.log("JUST_REMAINING", just.rows);

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
