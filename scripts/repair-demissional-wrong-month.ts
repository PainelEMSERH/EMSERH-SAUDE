/**
 * Remove demissionais em mês/ano diferente da demissão atual do colaborador.
 * Uso: npx tsx scripts/repair-demissional-wrong-month.ts
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../src/db";
import { asoMonthlyPlans, employees } from "../src/db/schemas";
import { yearMonthFromDate } from "../src/lib/aso/planning";

async function main() {
  const db = getDb();

  const rows = await db
    .select({
      planId: asoMonthlyPlans.id,
      registration: asoMonthlyPlans.registration,
      employeeName: asoMonthlyPlans.employeeName,
      planYear: asoMonthlyPlans.year,
      planMonth: asoMonthlyPlans.month,
      expectedDate: asoMonthlyPlans.expectedDate,
      executionStatus: asoMonthlyPlans.executionStatus,
      dismissalDate: employees.dismissalDate,
    })
    .from(asoMonthlyPlans)
    .innerJoin(employees, eq(employees.id, asoMonthlyPlans.employeeId))
    .where(
      and(
        isNull(asoMonthlyPlans.deletedAt),
        eq(asoMonthlyPlans.asoType, "DEMISSIONAL"),
        eq(asoMonthlyPlans.frozen, false),
        sql`${employees.dismissalDate} is not null`,
      ),
    );

  let removed = 0;
  let kept = 0;

  for (const row of rows) {
    const dem = yearMonthFromDate(
      row.dismissalDate ? String(row.dismissalDate) : null,
    );
    if (!dem) {
      kept += 1;
      continue;
    }
    if (dem.year === row.planYear && dem.month === row.planMonth) {
      kept += 1;
      continue;
    }

    await db
      .update(asoMonthlyPlans)
      .set({ deletedAt: new Date() })
      .where(eq(asoMonthlyPlans.id, row.planId));
    removed += 1;
    console.log(
      `REM ${row.registration} ${row.employeeName} · plano ${String(row.planMonth).padStart(2, "0")}/${row.planYear} (${row.executionStatus}) · demissão real ${dem.month}/${dem.year}`,
    );
  }

  // Quem não tem demissão e ainda tem demissional aberto
  const noDismissal = await db
    .select({
      planId: asoMonthlyPlans.id,
      registration: asoMonthlyPlans.registration,
      employeeName: asoMonthlyPlans.employeeName,
      planYear: asoMonthlyPlans.year,
      planMonth: asoMonthlyPlans.month,
    })
    .from(asoMonthlyPlans)
    .innerJoin(employees, eq(employees.id, asoMonthlyPlans.employeeId))
    .where(
      and(
        isNull(asoMonthlyPlans.deletedAt),
        eq(asoMonthlyPlans.asoType, "DEMISSIONAL"),
        eq(asoMonthlyPlans.frozen, false),
        sql`${employees.dismissalDate} is null`,
        sql`${asoMonthlyPlans.executionStatus} not in ('REALIZADO')`,
      ),
    );

  for (const row of noDismissal) {
    await db
      .update(asoMonthlyPlans)
      .set({ deletedAt: new Date() })
      .where(eq(asoMonthlyPlans.id, row.planId));
    removed += 1;
    console.log(
      `REM ${row.registration} ${row.employeeName} · plano ${row.planMonth}/${row.planYear} sem DtDemissao no cadastro`,
    );
  }

  console.log(`\nConcluído · removidos ${removed} · mantidos no mês certo ${kept}`);

  // Sul jan após limpeza
  const sul = await db.execute(sql`
    select
      count(*)::int as planejados,
      count(*) filter (where execution_status = 'REALIZADO')::int as realizados,
      string_agg(employee_name || ' (' || registration || ')', '; ' order by employee_name) as nomes
    from occupational.aso_monthly_plans p
    join core.regions r on r.id = p.region_id
    where p.deleted_at is null
      and p.aso_type = 'DEMISSIONAL'
      and p.year = 2026 and p.month = 1
      and r.code = 'SUL'
  `);
  console.log("SUL_JAN_APOS", JSON.stringify(sul.rows ?? sul, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
