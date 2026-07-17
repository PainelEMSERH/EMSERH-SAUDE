/**
 * Remove periódicos 2026 que não batem com o Proximo_aso confiável do Alterdata.
 *
 * Casos (ex.: Raimunda 003695):
 * - Plano em out/2026 (ASO_2026_CONTROL)
 * - Ultimo atestado em mar/jun 2026
 * - Proximo_aso em 2027 → não deveria aparecer em 2026
 *
 * Uso: npx tsx scripts/repair-periodic-vs-alterdata-next.ts
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../src/db";
import {
  asoAlterdataSnapshots,
  asoMonthlyPlans,
  employees,
} from "../src/db/schemas";
import { resolveTrustedPeriodicNext } from "../src/lib/aso/prediction";
import { yearMonthFromDate } from "../src/lib/aso/planning";

const YEAR = 2026;
const BATCH = 200;

async function main() {
  const db = getDb();

  const plans = await db
    .select({
      planId: asoMonthlyPlans.id,
      registration: asoMonthlyPlans.registration,
      employeeName: asoMonthlyPlans.employeeName,
      month: asoMonthlyPlans.month,
      admissionDate: employees.admissionDate,
    })
    .from(asoMonthlyPlans)
    .innerJoin(employees, eq(employees.id, asoMonthlyPlans.employeeId))
    .where(
      and(
        isNull(asoMonthlyPlans.deletedAt),
        eq(asoMonthlyPlans.asoType, "PERIODICO"),
        eq(asoMonthlyPlans.year, YEAR),
        eq(asoMonthlyPlans.frozen, false),
      ),
    );

  console.log(`Periódicos ${YEAR} abertos/ativos: ${plans.length}`);

  // Último snapshot por matrícula (1 query)
  const snapRows = await db.execute(sql`
    select distinct on (registration)
      registration,
      last_aso_date,
      next_aso_date,
      periodicity_months
    from occupational.aso_alterdata_snapshots
    order by registration, synced_at desc
  `);
  const snapList = (
    (snapRows as { rows?: Array<Record<string, unknown>> }).rows ??
    (snapRows as unknown as Array<Record<string, unknown>>)
  ) as Array<Record<string, unknown>>;

  const snapByReg = new Map<string, Record<string, unknown>>();
  for (const s of snapList) {
    snapByReg.set(String(s.registration), s);
  }
  console.log(`Snapshots Alterdata: ${snapByReg.size}`);

  const removeNextYear: string[] = [];
  const removeWrongMonth: string[] = [];
  const samples: string[] = [];
  let kept = 0;
  let noSnap = 0;

  for (const plan of plans) {
    const snap = snapByReg.get(plan.registration);
    if (!snap?.next_aso_date && !snap?.last_aso_date) {
      noSnap += 1;
      kept += 1;
      continue;
    }

    const trusted = resolveTrustedPeriodicNext({
      admissionDate: plan.admissionDate
        ? String(plan.admissionDate).slice(0, 10)
        : null,
      lastAsoDate: snap.last_aso_date
        ? String(snap.last_aso_date).slice(0, 10)
        : null,
      alterdataNextDate: snap.next_aso_date
        ? String(snap.next_aso_date).slice(0, 10)
        : null,
      periodicityMonths:
        typeof snap.periodicity_months === "number"
          ? snap.periodicity_months
          : Number(snap.periodicity_months) || 12,
    });

    const ym = yearMonthFromDate(trusted.nextPeriodicDate);
    if (!ym) {
      kept += 1;
      continue;
    }

    if (ym.year > YEAR) {
      removeNextYear.push(plan.planId);
      if (
        plan.registration === "003695" ||
        samples.length < 12 ||
        removeNextYear.length % 250 === 0
      ) {
        samples.push(
          `REM>ANO ${plan.registration} ${plan.employeeName} · plano ${plan.month}/${YEAR} · next ${trusted.nextPeriodicDate}`,
        );
      }
      continue;
    }

    if (ym.year === YEAR && ym.month !== plan.month) {
      removeWrongMonth.push(plan.planId);
      if (plan.registration === "003695" || samples.length < 20) {
        samples.push(
          `REM≠MÊS ${plan.registration} ${plan.employeeName} · plano ${plan.month} → deveria ${ym.month} · next ${trusted.nextPeriodicDate}`,
        );
      }
      continue;
    }

    kept += 1;
  }

  for (const line of samples) console.log(line);

  const allIds = [...removeNextYear, ...removeWrongMonth];
  for (let i = 0; i < allIds.length; i += BATCH) {
    const chunk = allIds.slice(i, i + BATCH);
    await db
      .update(asoMonthlyPlans)
      .set({ deletedAt: new Date() })
      .where(inArray(asoMonthlyPlans.id, chunk));
    console.log(`Soft-delete ${Math.min(i + BATCH, allIds.length)}/${allIds.length}`);
  }

  console.log(
    `\nConcluído · removidos next≥2027: ${removeNextYear.length} · mês errado: ${removeWrongMonth.length} · mantidos: ${kept} · sem snap: ${noSnap}`,
  );

  const out = await db.execute(sql`
    select
      count(*)::int as planejado,
      count(*) filter (where execution_status = 'REALIZADO')::int as executado
    from occupational.aso_monthly_plans
    where deleted_at is null
      and aso_type = 'PERIODICO'
      and year = 2026 and month = 10
  `);
  console.log(
    "OUTUBRO_APOS",
    JSON.stringify(
      (out as { rows?: unknown }).rows ?? out,
      null,
      2,
    ),
  );

  const raimunda = await db.execute(sql`
    select registration, month, expected_date::date, execution_status,
           deleted_at is not null as removido, prediction_origin
    from occupational.aso_monthly_plans
    where registration = '003695' and aso_type = 'PERIODICO' and year = 2026
    order by deleted_at nulls first, month
  `);
  console.log(
    "RAIMUNDA",
    JSON.stringify(
      (raimunda as { rows?: unknown }).rows ?? raimunda,
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
