/**
 * Marca demissionais abertos como REALIZADO/CONFIRMADO quando o Alterdata
 * já encerrou o ciclo (Status_ASO = DEMITIDO) ou há atestado ≥ demissão.
 *
 * Uso: npx tsx scripts/repair-demissional-alterdata-closed.ts
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

async function main() {
  const db = getDb();

  const open = await db
    .select({
      planId: asoMonthlyPlans.id,
      employeeId: asoMonthlyPlans.employeeId,
      registration: asoMonthlyPlans.registration,
      employeeName: asoMonthlyPlans.employeeName,
      expectedDate: asoMonthlyPlans.expectedDate,
      regionId: asoMonthlyPlans.regionId,
      unitId: asoMonthlyPlans.unitId,
      asoRecordId: asoMonthlyPlans.asoRecordId,
      dismissalDate: employees.dismissalDate,
    })
    .from(asoMonthlyPlans)
    .innerJoin(employees, eq(employees.id, asoMonthlyPlans.employeeId))
    .where(
      and(
        isNull(asoMonthlyPlans.deletedAt),
        eq(asoMonthlyPlans.asoType, "DEMISSIONAL"),
        sql`${asoMonthlyPlans.executionStatus} not in ('REALIZADO')`,
      ),
    );

  console.log(`Demissionais abertos: ${open.length}`);

  let fixed = 0;
  let skipped = 0;

  for (const row of open) {
    const [snap] = await db
      .select()
      .from(asoAlterdataSnapshots)
      .where(eq(asoAlterdataSnapshots.registration, row.registration))
      .orderBy(desc(asoAlterdataSnapshots.syncedAt))
      .limit(1);

    const demIso = row.dismissalDate
      ? String(row.dismissalDate).slice(0, 10)
      : row.expectedDate
        ? String(row.expectedDate).slice(0, 10)
        : null;
    const lastIso = snap?.lastAsoDate
      ? String(snap.lastAsoDate).slice(0, 10)
      : null;
    const statusAso = String(snap?.statusAso || "")
      .trim()
      .toUpperCase();

    const done = Boolean(
      demIso && ((lastIso && lastIso >= demIso) || statusAso === "DEMITIDO"),
    );
    if (!done || !demIso) {
      skipped += 1;
      continue;
    }

    const performedDate =
      lastIso && lastIso >= demIso ? lastIso : demIso;

    let asoRecordId = row.asoRecordId;
    if (!asoRecordId) {
      const [created] = await db
        .insert(asoRecords)
        .values({
          employeeId: row.employeeId,
          asoType: "DEMISSIONAL",
          expectedDate: row.expectedDate ?? demIso,
          performedDate,
          lastAsoDate: performedDate,
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
        justificationReason: null,
      })
      .where(eq(asoMonthlyPlans.id, row.planId));

    fixed += 1;
    if (
      row.registration === "006828" ||
      fixed <= 5 ||
      fixed % 50 === 0
    ) {
      console.log(
        `OK ${row.registration} ${row.employeeName} · dem ${demIso} · last ${lastIso} · status ${statusAso} · realizado ${performedDate}`,
      );
    }
  }

  console.log(`\nConcluído · corrigidos ${fixed} · sem evidência ${skipped}`);

  const sulJan = await sqlRaw(db);
  console.log("SUL_JAN", JSON.stringify(sulJan, null, 2));
}

async function sqlRaw(db: ReturnType<typeof getDb>) {
  return db.execute(sql`
    select p.registration, p.employee_name, p.execution_status, p.alterdata_status,
           e.dismissal_date::date as dismissal
    from occupational.aso_monthly_plans p
    join core.employees e on e.id = p.employee_id
    join core.regions r on r.id = p.region_id
    where p.deleted_at is null
      and p.aso_type = 'DEMISSIONAL'
      and p.year = 2026 and p.month = 1
      and r.code = 'SUL'
    order by p.employee_name
  `);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
