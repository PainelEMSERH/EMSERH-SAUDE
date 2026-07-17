/**
 * Fecha afastamentos com período vencido e concilia retorno ASO com Alterdata.
 *
 * - status ATIVO + end_date < hoje → ENCERRADO + days_count
 * - tipo 01 → requires_return_aso = true
 * - last_aso do espelho ≥ end_date → actual_return_date = last_aso
 *
 * Uso: npx tsx scripts/repair-leaves-return-alterdata.ts
 */
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

  const req = await c.query(`
    update occupational.leave_records
    set requires_return_aso = true, updated_at = now()
    where deleted_at is null
      and leave_type like '01%'
      and requires_return_aso = false
    returning id
  `);
  console.log("REQUIRES_RETURN_ASO", req.rowCount);

  const closed = await c.query(`
    update occupational.leave_records
    set
      status = 'ENCERRADO',
      days_count = coalesce(
        days_count,
        case
          when start_date is not null and end_date is not null
            then (end_date::date - start_date::date) + 1
          else null
        end
      ),
      updated_at = now()
    where deleted_at is null
      and status = 'ATIVO'
      and end_date is not null
      and end_date::date < current_date
    returning id
  `);
  console.log("CLOSED_BY_END_DATE", closed.rowCount);

  const returned = await c.query(`
    with latest as (
      select distinct on (registration)
        registration,
        last_aso_date::date as last_aso
      from occupational.aso_alterdata_snapshots
      where last_aso_date is not null
      order by registration, synced_at desc
    )
    update occupational.leave_records l
    set
      actual_return_date = latest.last_aso,
      status = 'ENCERRADO',
      requires_return_aso = true,
      days_count = coalesce(
        l.days_count,
        case
          when l.start_date is not null and l.end_date is not null
            then (l.end_date::date - l.start_date::date) + 1
          else null
        end
      ),
      updated_at = now()
    from core.employees e
    join latest on latest.registration = e.registration
    where e.id = l.employee_id
      and l.deleted_at is null
      and (
        l.requires_return_aso = true
        or l.leave_type like '01%'
      )
      and l.end_date is not null
      and latest.last_aso >= l.end_date::date
      and (
        l.actual_return_date is null
        or l.status = 'ATIVO'
      )
    returning l.id, e.registration, l.end_date::date as fim, latest.last_aso
  `);
  console.log("RETURN_FROM_ALTERDATA", returned.rowCount);
  const janira = returned.rows.filter((r) => r.registration === "011661");
  console.log("JANIRA", janira);

  const sample = await c.query(`
    select e.registration, left(e.full_name,40) nome,
           l.leave_type, l.status, l.start_date::date, l.end_date::date,
           l.actual_return_date::date, l.days_count
    from occupational.leave_records l
    join core.employees e on e.id = l.employee_id
    where e.registration = '011661' and l.leave_type like '01%'
      and l.deleted_at is null
    order by l.start_date desc
  `);
  console.log("JANIRA_AFTER", sample.rows);

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
