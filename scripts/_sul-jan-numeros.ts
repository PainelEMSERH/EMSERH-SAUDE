/**
 * Números oficiais do sistema: Sul · PERIODICO · Jan/2026
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { Client } from "pg";
import { computeCompetenceMetrics } from "../src/lib/aso/indicators";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const c = new Client({
    connectionString:
      process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const plans = await c.query(`
    select
      p.registration,
      p.employee_name,
      p.expected_date::text as expected_date,
      p.execution_status,
      p.eligibility,
      p.justification_reason,
      p.alterdata_status,
      p.aso_record_id,
      ar.performed_date::text as performed_date,
      p.functional_status_snapshot,
      u.name as unit_name
    from occupational.aso_monthly_plans p
    join core.regions r on r.id = p.region_id
    left join core.units u on u.id = p.unit_id
    left join occupational.aso_records ar on ar.id = p.aso_record_id
    where p.deleted_at is null
      and p.aso_type = 'PERIODICO'
      and p.year = 2026 and p.month = 1
      and r.code = 'SUL'
    order by p.employee_name
  `);

  let metaPercent: number | null = null;
  try {
    const target = await c.query(`
      select scope_type, target_percent, aso_type
      from occupational.aso_targets t
      left join core.regions r on r.id = t.region_id
      where t.year = 2026 and t.month = 1
        and (t.aso_type = 'PERIODICO' or t.aso_type = 'ALL')
        and (
          t.scope_type = 'EMSERH'
          or (t.scope_type = 'REGION' and r.code = 'SUL')
        )
      order by case when t.scope_type = 'REGION' then 0 else 1 end
      limit 5
    `);
    if (target.rows[0]) metaPercent = Number(target.rows[0].target_percent);
    console.log("META_CADASTRADA", target.rows);
  } catch (e) {
    console.log("META_CADASTRADA_ERRO", String(e));
  }

  const metrics = computeCompetenceMetrics(
    plans.rows.map((r) => ({
      eligibility: r.eligibility,
      executionStatus: r.execution_status,
      alterdataStatus: r.alterdata_status,
      expectedDate: r.expected_date,
      asoRecordId: r.aso_record_id,
      performedDate: r.performed_date,
      justificationReason: r.justification_reason,
      functionalStatusSnapshot: r.functional_status_snapshot,
    })),
    metaPercent,
  );

  const justByReason = new Map<string, number>();
  const justList: Array<Record<string, string>> = [];
  const pendingList: Array<Record<string, string>> = [];

  for (const r of plans.rows) {
    const elig = String(r.eligibility || "").toUpperCase();
    const exec = String(r.execution_status || "").toUpperCase();
    const reason =
      String(r.justification_reason || "").toUpperCase() || "(SEM_MOTIVO)";

    const outOfDenom =
      elig === "JUSTIFICADO" ||
      elig === "NAO_ELEGIVEL" ||
      (exec === "JUSTIFICADO" && elig !== "ELEGIVEL") ||
      exec === "DISPENSADO";

    if (outOfDenom) {
      justByReason.set(reason, (justByReason.get(reason) || 0) + 1);
      justList.push({
        reg: r.registration,
        name: r.employee_name,
        reason,
        elig,
        exec,
        unit: r.unit_name || "",
      });
      continue;
    }

    if (exec !== "REALIZADO") {
      pendingList.push({
        reg: r.registration,
        name: r.employee_name,
        expected: r.expected_date || "",
        status: exec,
        unit: r.unit_name || "",
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        filtro: "Sul · PERIODICO · Jan/2026",
        previstosBrutos: metrics.previstosBrutos,
        elegiveis: metrics.previstosElegiveis,
        metaPercent: metrics.metaPercent,
        metaDefined: metrics.metaDefined,
        faltamParaMeta: metrics.faltamParaMeta,
        realizados: metrics.realizados,
        justificados: metrics.justificados,
        justificadosPorMotivo: Object.fromEntries(justByReason),
        naoRealizados: metrics.naoRealizados,
        vencidos: metrics.vencidos,
        aderenciaPercent: metrics.aderenciaPercent,
        afastados: metrics.afastados,
        ferias: metrics.ferias,
        faltamFazer: pendingList.length,
        pendentesDetalhe: pendingList,
        justificadosDetalhe: justList,
      },
      null,
      2,
    ),
  );

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
