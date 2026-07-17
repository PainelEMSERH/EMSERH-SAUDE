/**
 * Listas nominais: Sul · PERIODICO · Jan/2026
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { Client } from "pg";
import {
  JUSTIFIED_ELIGIBILITY,
  REALIZED_EXECUTION,
  type Eligibility,
  type ExecutionStatus,
} from "../src/lib/aso/constants";

config({ path: resolve(process.cwd(), ".env.local") });

function line(r: {
  registration: string;
  employee_name: string;
  expected_date?: string | null;
  unit_name?: string | null;
  execution_status?: string;
  eligibility?: string;
  justification_reason?: string | null;
}) {
  const bits = [
    r.registration,
    r.employee_name,
    r.expected_date ? `prev ${r.expected_date}` : null,
    r.unit_name || null,
    r.justification_reason ? `motivo ${r.justification_reason}` : null,
  ].filter(Boolean);
  return bits.join(" | ");
}

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
      coalesce(u.name, p.unit_name_snapshot) as unit_name
    from occupational.aso_monthly_plans p
    join core.regions r on r.id = p.region_id
    left join core.units u on u.id = p.unit_id
    where p.deleted_at is null
      and p.aso_type = 'PERIODICO'
      and p.year = 2026 and p.month = 1
      and r.code = 'SUL'
    order by p.employee_name
  `);

  const previstos: typeof plans.rows = [];
  const elegiveis: typeof plans.rows = [];
  const realizados: typeof plans.rows = [];
  const pendentes: typeof plans.rows = [];
  const justificados: typeof plans.rows = [];

  for (const r of plans.rows) {
    previstos.push(r);
    const elig = String(r.eligibility || "").toUpperCase();
    const exec = String(r.execution_status || "").toUpperCase();

    if (
      JUSTIFIED_ELIGIBILITY.has(elig as Eligibility) ||
      exec === "JUSTIFICADO" ||
      exec === "DISPENSADO"
    ) {
      if (elig === "ELEGIVEL" && exec === "JUSTIFICADO") {
        elegiveis.push(r);
        pendentes.push(r);
      } else {
        justificados.push(r);
      }
      continue;
    }

    elegiveis.push(r);
    if (REALIZED_EXECUTION.has(exec as ExecutionStatus)) {
      realizados.push(r);
    } else {
      pendentes.push(r);
    }
  }

  function dump(title: string, rows: typeof plans.rows) {
    console.log(`\n===== ${title} (${rows.length}) =====`);
    rows.forEach((r, i) => console.log(`${String(i + 1).padStart(3, " ")}. ${line(r)}`));
  }

  dump("PREVISTOS BRUTOS", previstos);
  dump("ELEGÍVEIS (denominador)", elegiveis);
  dump("REALIZADOS", realizados);
  dump("PENDENTES / FALTAM FAZER", pendentes);
  dump("JUSTIFICADOS (fora do denominador)", justificados);

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
