/**
 * Recalcula alterdata_status dos planos com realização (usa reconcileAlterdataStatus).
 * Uso: npx tsx scripts/refresh-alterdata-statuses.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { refreshPlanAlterdataStatuses } = await import(
    "../src/db/queries/aso-panel"
  );
  const result = await refreshPlanAlterdataStatuses(20000);
  console.log(result);

  // Check 011612
  const { Client } = await import("pg");
  const c = new Client({
    connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const r = await c.query(
    `select p.registration, p.alterdata_status, p.execution_status,
            p.expected_date::text, r.performed_date::text
     from occupational.aso_monthly_plans p
     left join occupational.aso_records r on r.id = p.aso_record_id
     where p.deleted_at is null
       and p.registration in ('011612','11612')
     order by p.year, p.month`,
  );
  console.log("011612", r.rows);

  const counts = await c.query(
    `select alterdata_status, count(*)::int n
     from occupational.aso_monthly_plans
     where deleted_at is null and execution_status = 'REALIZADO'
     group by 1 order by 2 desc`,
  );
  console.log("REALIZADO_BY_ALT", counts.rows);
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
