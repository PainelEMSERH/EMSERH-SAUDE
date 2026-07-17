/**
 * Vincula aso_records legados (já realizados) aos itens de planejamento mensal
 * correspondentes, sem duplicar histórico. Idempotente: pode ser executada
 * repetidas vezes sem efeitos colaterais além de preencher vínculos ausentes.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { asoMonthlyPlans, asoRecords, employees, regions, units } from "@/db/schemas";
import { eligibilityFromFunctionalStatus, yearMonthFromDate } from "./planning";

export type MigrateExistingResult = {
  scanned: number;
  linked: number;
  createdPlans: number;
  skippedFrozen: number;
  skippedNoDate: number;
};

/**
 * Para cada aso_record com performedDate (ou expectedDate, na ausência),
 * localiza ou cria o item de planejamento (employeeId + asoType + ano/mês)
 * e vincula asoRecordId, sem sobrescrever itens congelados.
 */
export async function migrateExistingAsoRecordsToPlans(
  updatedBy?: string | null,
): Promise<MigrateExistingResult> {
  const db = getDb();

  const records = await db
    .select({
      id: asoRecords.id,
      employeeId: asoRecords.employeeId,
      asoType: asoRecords.asoType,
      performedDate: asoRecords.performedDate,
      expectedDate: asoRecords.expectedDate,
      planId: asoRecords.planId,
      registration: employees.registration,
      employeeName: employees.fullName,
      functionalStatus: employees.functionalStatus,
      regionId: employees.regionId,
      unitId: employees.unitId,
      regionName: regions.name,
      unitName: units.name,
    })
    .from(asoRecords)
    .innerJoin(employees, eq(asoRecords.employeeId, employees.id))
    .leftJoin(regions, eq(employees.regionId, regions.id))
    .leftJoin(units, eq(employees.unitId, units.id))
    .where(
      and(
        isNull(asoRecords.deletedAt),
        sql`(${asoRecords.performedDate} is not null or ${asoRecords.expectedDate} is not null)`,
      ),
    );

  let scanned = 0;
  let linked = 0;
  let createdPlans = 0;
  let skippedFrozen = 0;
  let skippedNoDate = 0;

  for (const rec of records) {
    scanned += 1;
    if (rec.planId) continue;

    // Prioriza o mês de referência da realização; sem ela, usa a previsão.
    const ym =
      yearMonthFromDate(rec.performedDate) ?? yearMonthFromDate(rec.expectedDate);
    if (!ym) {
      skippedNoDate += 1;
      continue;
    }

    const [existingPlan] = await db
      .select()
      .from(asoMonthlyPlans)
      .where(
        and(
          eq(asoMonthlyPlans.employeeId, rec.employeeId),
          eq(asoMonthlyPlans.asoType, rec.asoType),
          eq(asoMonthlyPlans.year, ym.year),
          eq(asoMonthlyPlans.month, ym.month),
          isNull(asoMonthlyPlans.deletedAt),
        ),
      )
      .limit(1);

    let planId: string;
    if (existingPlan) {
      if (existingPlan.frozen) {
        skippedFrozen += 1;
        continue;
      }
      planId = existingPlan.id;
      const isRealized = Boolean(rec.performedDate);
      await db
        .update(asoMonthlyPlans)
        .set({
          asoRecordId: rec.id,
          executionStatus: isRealized ? "REALIZADO" : existingPlan.executionStatus,
          alterdataStatus: isRealized
            ? existingPlan.alterdataStatus === "NAO_APLICAVEL"
              ? "AGUARDANDO_SINCRONIZACAO"
              : existingPlan.alterdataStatus
            : existingPlan.alterdataStatus,
          updatedBy: updatedBy ?? existingPlan.updatedBy,
        })
        .where(eq(asoMonthlyPlans.id, existingPlan.id));
    } else {
      const elig = eligibilityFromFunctionalStatus(rec.functionalStatus);
      const isRealized = Boolean(rec.performedDate);
      const [created] = await db
        .insert(asoMonthlyPlans)
        .values({
          employeeId: rec.employeeId,
          registration: rec.registration,
          employeeName: rec.employeeName,
          asoType: rec.asoType,
          year: ym.year,
          month: ym.month,
          expectedDate: rec.expectedDate ?? rec.performedDate,
          regionId: rec.regionId,
          unitId: rec.unitId,
          regionNameSnapshot: rec.regionName,
          unitNameSnapshot: rec.unitName,
          functionalStatusSnapshot: rec.functionalStatus,
          predictionOrigin: "MIGRATION",
          eligibility: elig.eligibility,
          justificationReason: elig.reason,
          executionStatus: isRealized ? "REALIZADO" : "PREVISTO",
          alterdataStatus: isRealized ? "AGUARDANDO_SINCRONIZACAO" : "NAO_APLICAVEL",
          asoRecordId: rec.id,
          createdBy: updatedBy ?? null,
          updatedBy: updatedBy ?? null,
        })
        .returning({ id: asoMonthlyPlans.id });
      planId = created.id;
      createdPlans += 1;
    }

    await db
      .update(asoRecords)
      .set({ planId })
      .where(eq(asoRecords.id, rec.id));
    linked += 1;
  }

  return { scanned, linked, createdPlans, skippedFrozen, skippedNoDate };
}
