/**
 * Diagnóstico + correção: AFASTADO/FÉRIAS em planos periódicos elegíveis
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { Client } from "pg";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const dry = process.argv.includes("--dry");
  const c = new Client({
    connectionString:
      process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const raimundo = await c.query(`
    select e.registration, e.full_name, e.functional_status,
           p.id as plan_id, p.year, p.month, p.eligibility, p.execution_status,
           p.justification_reason, p.functional_status_snapshot
    from core.employees e
    left join occupational.aso_monthly_plans p
      on p.employee_id = e.id and p.deleted_at is null
     and p.aso_type = 'PERIODICO' and p.year = 2026 and p.month = 1
    where e.deleted_at is null
      and regexp_replace(e.registration, '^0+', '') = '9334'
  `);
  console.log("RAIMUNDO", JSON.stringify(raimundo.rows, null, 2));

  // Planos elegíveis cujo colaborador está afastado/férias (ou snapshot)
  const broken = await c.query(`
    select
      p.id,
      p.registration,
      p.employee_name,
      p.year,
      p.month,
      p.eligibility,
      p.execution_status,
      p.justification_reason,
      p.functional_status_snapshot,
      e.functional_status as emp_status,
      r.code as region
    from occupational.aso_monthly_plans p
    join core.employees e on e.id = p.employee_id
    left join core.regions r on r.id = p.region_id
    where p.deleted_at is null
      and e.deleted_at is null
      and p.aso_type = 'PERIODICO'
      and p.year = 2026
      and p.eligibility = 'ELEGIVEL'
      and (
        upper(coalesce(e.functional_status, '')) in ('AFASTADO', 'FERIAS')
        or upper(coalesce(p.functional_status_snapshot, '')) in ('AFASTADO', 'FERIAS')
      )
    order by p.month, p.employee_name
  `);

  console.log(`\nPLANOS_ELEGIVEIS_COM_AFASTADO_OU_FERIAS: ${broken.rows.length}`);
  const byReason = new Map<string, number>();
  for (const row of broken.rows) {
    const status =
      ["AFASTADO", "FERIAS"].includes(
        String(row.emp_status || "").toUpperCase(),
      )
        ? String(row.emp_status).toUpperCase()
        : String(row.functional_status_snapshot || "").toUpperCase();
    byReason.set(status, (byReason.get(status) || 0) + 1);
    console.log(
      `${row.registration} | ${row.employee_name} | ${row.year}-${String(row.month).padStart(2, "0")} | ${row.region} | emp=${row.emp_status} snap=${row.functional_status_snapshot} | ${row.execution_status}`,
    );
  }
  console.log("POR_MOTIVO", Object.fromEntries(byReason));

  if (dry) {
    console.log("\nDRY-RUN — nenhuma alteração");
    await c.end();
    return;
  }

  const upd = await c.query(`
    update occupational.aso_monthly_plans p
    set
      eligibility = 'JUSTIFICADO',
      execution_status = 'JUSTIFICADO',
      justification_reason = case
        when upper(coalesce(e.functional_status, '')) = 'FERIAS'
          or upper(coalesce(p.functional_status_snapshot, '')) = 'FERIAS'
          then 'FERIAS'
        else 'AFASTADO'
      end,
      functional_status_snapshot = case
        when upper(coalesce(e.functional_status, '')) in ('AFASTADO', 'FERIAS')
          then e.functional_status
        when upper(coalesce(p.functional_status_snapshot, '')) in ('AFASTADO', 'FERIAS')
          then p.functional_status_snapshot
        else 'AFASTADO'
      end,
      justified_at = coalesce(p.justified_at, now()),
      updated_at = now()
    from core.employees e
    where e.id = p.employee_id
      and p.deleted_at is null
      and e.deleted_at is null
      and p.aso_type = 'PERIODICO'
      and p.year = 2026
      and p.eligibility = 'ELEGIVEL'
      and (
        upper(coalesce(e.functional_status, '')) in ('AFASTADO', 'FERIAS')
        or upper(coalesce(p.functional_status_snapshot, '')) in ('AFASTADO', 'FERIAS')
      )
    returning p.registration, p.employee_name, p.month, p.justification_reason
  `);

  console.log(`\nCORRIGIDOS: ${upd.rows.length}`);
  for (const row of upd.rows) {
    console.log(
      `OK ${row.registration} | ${row.employee_name} | mês ${row.month} | ${row.justification_reason}`,
    );
  }

  // Conferência Sul jan após correção
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
      count(*) filter (
        where eligibility in ('JUSTIFICADO', 'NAO_ELEGIVEL')
           or execution_status in ('JUSTIFICADO', 'DISPENSADO')
      )::int as justificados,
      count(*) filter (where justification_reason = 'AFASTADO')::int as afastados,
      count(*) filter (where justification_reason = 'FERIAS')::int as ferias,
      count(*) filter (where justification_reason = 'DEMITIDO')::int as demitidos
    from occupational.aso_monthly_plans p
    join core.regions r on r.id = p.region_id
    where p.deleted_at is null
      and p.aso_type = 'PERIODICO'
      and p.year = 2026 and p.month = 1
      and r.code = 'SUL'
  `);
  console.log("\nSUL_JAN_APOS", sul.rows[0]);

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
