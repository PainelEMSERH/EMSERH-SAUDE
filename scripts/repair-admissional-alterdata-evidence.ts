/**
 * Repara admissionais abertos em 2026 com evidência no Alterdata
 * (inclui recontratação: Ultimo_aso pré-admissão + Proximo_aso após admissão).
 *
 * Uso: npx tsx scripts/repair-admissional-alterdata-evidence.ts
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../src/db";
import {
  asoAlterdataSnapshots,
  asoMonthlyPlans,
  asoRecords,
  employees,
} from "../src/db/schemas";
import {
  hasAdmissionAsoEvidence,
  resolveTrustedPeriodicNext,
} from "../src/lib/aso/prediction";
import { yearMonthFromDate } from "../src/lib/aso/planning";

const YEAR = 2026;

async function main() {
  const db = getDb();

  const open = await db
    .select({
      planId: asoMonthlyPlans.id,
      employeeId: asoMonthlyPlans.employeeId,
      registration: asoMonthlyPlans.registration,
      employeeName: asoMonthlyPlans.employeeName,
      month: asoMonthlyPlans.month,
      expectedDate: asoMonthlyPlans.expectedDate,
      regionId: asoMonthlyPlans.regionId,
      unitId: asoMonthlyPlans.unitId,
      asoRecordId: asoMonthlyPlans.asoRecordId,
      admissionDate: employees.admissionDate,
    })
    .from(asoMonthlyPlans)
    .innerJoin(employees, eq(employees.id, asoMonthlyPlans.employeeId))
    .where(
      and(
        isNull(asoMonthlyPlans.deletedAt),
        eq(asoMonthlyPlans.asoType, "ADMISSIONAL"),
        eq(asoMonthlyPlans.year, YEAR),
        sql`${asoMonthlyPlans.executionStatus} not in ('REALIZADO','JUSTIFICADO','DISPENSADO')`,
      ),
    );

  console.log(`Admissionais abertos ${YEAR}: ${open.length}`);

  let fixed = 0;
  let periodicUpserted = 0;
  let skipped = 0;

  for (const row of open) {
    const [snap] = await db
      .select()
      .from(asoAlterdataSnapshots)
      .where(eq(asoAlterdataSnapshots.registration, row.registration))
      .orderBy(desc(asoAlterdataSnapshots.syncedAt))
      .limit(1);

    const admissionIso = row.admissionDate
      ? String(row.admissionDate).slice(0, 10)
      : null;
    const lastIso = snap?.lastAsoDate
      ? String(snap.lastAsoDate).slice(0, 10)
      : null;
    const nextIso = snap?.nextAsoDate
      ? String(snap.nextAsoDate).slice(0, 10)
      : null;

    if (!hasAdmissionAsoEvidence(admissionIso, lastIso, nextIso)) {
      skipped += 1;
      continue;
    }

    const trusted = resolveTrustedPeriodicNext({
      admissionDate: admissionIso,
      lastAsoDate: lastIso,
      alterdataNextDate: nextIso,
      periodicityMonths: snap?.periodicityMonths ?? 12,
    });

    const lastAfterAdmission = Boolean(
      lastIso && admissionIso && lastIso >= admissionIso,
    );
    const performedDate = lastAfterAdmission ? lastIso! : admissionIso!;

    let asoRecordId = row.asoRecordId;
    if (!asoRecordId) {
      const [created] = await db
        .insert(asoRecords)
        .values({
          employeeId: row.employeeId,
          asoType: "ADMISSIONAL",
          expectedDate: row.expectedDate,
          performedDate,
          lastAsoDate: performedDate,
          nextAsoDate: trusted.nextPeriodicDate,
          origin: "SYNC",
          regionId: row.regionId,
          unitId: row.unitId,
        })
        .returning({ id: asoRecords.id });
      asoRecordId = created.id;
    } else {
      await db
        .update(asoRecords)
        .set({
          performedDate,
          lastAsoDate: performedDate,
          nextAsoDate: trusted.nextPeriodicDate,
          origin: "SYNC",
        })
        .where(eq(asoRecords.id, asoRecordId));
    }

    await db
      .update(asoMonthlyPlans)
      .set({
        executionStatus: "REALIZADO",
        alterdataStatus: "CONFIRMADO",
        asoRecordId,
        eligibility: "ELEGIVEL",
      })
      .where(eq(asoMonthlyPlans.id, row.planId));

    fixed += 1;
    console.log(
      `OK ${row.registration} ${row.employeeName} · adm ${admissionIso} · last ${lastIso} · next ${nextIso} · realizado ${performedDate}`,
    );

    // Garante periódico do Proximo_aso no ano, se cair em 2026
    const ym = yearMonthFromDate(trusted.nextPeriodicDate);
    if (ym && ym.year === YEAR && trusted.nextPeriodicDate) {
      const [existingPeriodic] = await db
        .select({ id: asoMonthlyPlans.id })
        .from(asoMonthlyPlans)
        .where(
          and(
            eq(asoMonthlyPlans.employeeId, row.employeeId),
            eq(asoMonthlyPlans.asoType, "PERIODICO"),
            eq(asoMonthlyPlans.year, YEAR),
            eq(asoMonthlyPlans.month, ym.month),
            isNull(asoMonthlyPlans.deletedAt),
          ),
        )
        .limit(1);

      if (!existingPeriodic) {
        await db.insert(asoMonthlyPlans).values({
          employeeId: row.employeeId,
          registration: row.registration,
          employeeName: row.employeeName,
          asoType: "PERIODICO",
          year: YEAR,
          month: ym.month,
          expectedDate: trusted.nextPeriodicDate,
          regionId: row.regionId,
          unitId: row.unitId,
          predictionOrigin:
            trusted.trust === "ALTERDATA"
              ? "ALTERDATA_NEXT_ASO"
              : trusted.trust === "RECOMPUTED_FROM_LAST"
                ? "RECOMPUTED_FROM_LAST_ASO"
                : "RECOMPUTED_FROM_ADMISSION",
          eligibility: "ELEGIVEL",
          executionStatus: "PREVISTO",
          alterdataStatus: "NAO_APLICAVEL",
        });
        periodicUpserted += 1;
        console.log(
          `  + periódico ${ym.month}/${YEAR} (${trusted.nextPeriodicDate})`,
        );
      }
    }
  }

  console.log(
    `\nConcluído · corrigidos ${fixed} · periódicos criados ${periodicUpserted} · sem evidência ${skipped}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
