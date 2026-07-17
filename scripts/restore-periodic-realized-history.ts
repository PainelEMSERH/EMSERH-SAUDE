/**
 * Desfaz limpeza agressiva: restaura periódicos REALIZADOS de competências
 * já ocorridas/atuais (mês ≤ competência de hoje) que foram soft-deletados
 * só porque o Proximo_aso já avançou para 2027+.
 *
 * Mantém removidos os fantasmas futuros (ex.: Raimunda em out/2026).
 *
 * Uso: npx tsx scripts/restore-periodic-realized-history.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { Client } from "pg";

config({ path: resolve(process.cwd(), ".env.local") });

const YEAR = 2026;
/** Competência corrente (hoje = 17/07/2026). */
const CURRENT_MONTH = 7;

async function main() {
  const c = new Client({
    connectionString:
      process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const preview = await c.query(
    `
    select month,
      count(*)::int n,
      count(*) filter (where registration = '003695')::int raimunda
    from occupational.aso_monthly_plans
    where aso_type = 'PERIODICO'
      and year = $1
      and deleted_at is not null
      and deleted_at >= now() - interval '12 hours'
      and execution_status = 'REALIZADO'
      and month <= $2
      and coalesce(frozen, false) = false
    group by month
    order by month
  `,
    [YEAR, CURRENT_MONTH],
  );
  console.log("A_RESTAURAR_POR_MES", preview.rows);

  const restored = await c.query(
    `
    update occupational.aso_monthly_plans
    set deleted_at = null, updated_at = now()
    where aso_type = 'PERIODICO'
      and year = $1
      and deleted_at is not null
      and deleted_at >= now() - interval '12 hours'
      and execution_status = 'REALIZADO'
      and month <= $2
      and coalesce(frozen, false) = false
    returning id, month, registration
  `,
    [YEAR, CURRENT_MONTH],
  );
  console.log("RESTAURADOS", restored.rowCount);

  const byMonth = await c.query(`
    select month,
      count(*) filter (where deleted_at is null)::int planejado,
      count(*) filter (where deleted_at is null and execution_status='REALIZADO')::int executado
    from occupational.aso_monthly_plans
    where aso_type='PERIODICO' and year=2026
    group by month
    order by month
  `);
  console.log("APOS_POR_MES", byMonth.rows);

  const raimunda = await c.query(`
    select month, execution_status, deleted_at is not null as removido
    from occupational.aso_monthly_plans
    where registration='003695' and aso_type='PERIODICO' and year=2026
    order by month
  `);
  console.log("RAIMUNDA", raimunda.rows);

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
