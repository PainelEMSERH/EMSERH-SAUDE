import { and, count, eq, gte, isNull, lte } from "drizzle-orm";
import { getDb } from "@/db";
import {
  asoRecords,
  biologicalAccidentFollowups,
  biologicalAccidents,
  employees,
  leaveRecords,
  pregnancyCases,
} from "@/db/schemas";
import { isDatabaseConfigured } from "@/lib/env";
import { employeeScopeCondition } from "@/lib/scope";
import type { SessionUser } from "@/types";

export type DashboardMetrics = {
  activeEmployees: number;
  asoOverdue: number;
  asoDueSoon: number;
  asoExpectedPeriod: number;
  asoPerformed: number;
  activeLeaves: number;
  pendingReturns: number;
  pregnancies: number;
  hazardousWithoutRelocation: number;
  bioAccidents: number;
  pendingFollowups: number;
  configured: boolean;
};

export async function getDashboardMetrics(
  user: SessionUser | null,
): Promise<DashboardMetrics> {
  const empty: DashboardMetrics = {
    activeEmployees: 0,
    asoOverdue: 0,
    asoDueSoon: 0,
    asoExpectedPeriod: 0,
    asoPerformed: 0,
    activeLeaves: 0,
    pendingReturns: 0,
    pregnancies: 0,
    hazardousWithoutRelocation: 0,
    bioAccidents: 0,
    pendingFollowups: 0,
    configured: false,
  };

  if (!isDatabaseConfigured() || !user) return empty;

  const db = getDb();
  const scope = employeeScopeCondition(user);
  const today = new Date();
  const in30 = new Date();
  in30.setDate(today.getDate() + 30);
  const todayStr = today.toISOString().slice(0, 10);
  const in30Str = in30.toISOString().slice(0, 10);
  const monthStart = `${todayStr.slice(0, 7)}-01`;

  const empBase = and(isNull(employees.deletedAt), scope);

  const [activeEmployees] = await db
    .select({ value: count() })
    .from(employees)
    .where(and(empBase, eq(employees.functionalStatus, "ATIVO")));

  const [asoOverdue] = await db
    .select({ value: count() })
    .from(asoRecords)
    .innerJoin(employees, eq(asoRecords.employeeId, employees.id))
    .where(
      and(
        isNull(asoRecords.deletedAt),
        eq(asoRecords.deadlineStatus, "VENCIDO"),
        empBase,
      ),
    );

  const [asoDueSoon] = await db
    .select({ value: count() })
    .from(asoRecords)
    .innerJoin(employees, eq(asoRecords.employeeId, employees.id))
    .where(
      and(
        isNull(asoRecords.deletedAt),
        eq(asoRecords.deadlineStatus, "A_VENCER"),
        gte(asoRecords.nextAsoDate, todayStr),
        lte(asoRecords.nextAsoDate, in30Str),
        empBase,
      ),
    );

  const [asoExpectedPeriod] = await db
    .select({ value: count() })
    .from(asoRecords)
    .innerJoin(employees, eq(asoRecords.employeeId, employees.id))
    .where(
      and(
        isNull(asoRecords.deletedAt),
        gte(asoRecords.expectedDate, todayStr),
        lte(asoRecords.expectedDate, in30Str),
        empBase,
      ),
    );

  const [asoPerformed] = await db
    .select({ value: count() })
    .from(asoRecords)
    .innerJoin(employees, eq(asoRecords.employeeId, employees.id))
    .where(
      and(
        isNull(asoRecords.deletedAt),
        gte(asoRecords.performedDate, monthStart),
        empBase,
      ),
    );

  const [activeLeaves] = await db
    .select({ value: count() })
    .from(leaveRecords)
    .innerJoin(employees, eq(leaveRecords.employeeId, employees.id))
    .where(
      and(
        isNull(leaveRecords.deletedAt),
        eq(leaveRecords.status, "ATIVO"),
        empBase,
      ),
    );

  // Retornos pendentes: afastamento encerrado sem data efetiva de retorno
  // e com necessidade de ASO de retorno marcada.
  const [pendingReturns] = await db
    .select({ value: count() })
    .from(leaveRecords)
    .innerJoin(employees, eq(leaveRecords.employeeId, employees.id))
    .where(
      and(
        isNull(leaveRecords.deletedAt),
        eq(leaveRecords.requiresReturnAso, true),
        isNull(leaveRecords.actualReturnDate),
        empBase,
      ),
    );

  const [pregnancies] = await db
    .select({ value: count() })
    .from(pregnancyCases)
    .innerJoin(employees, eq(pregnancyCases.employeeId, employees.id))
    .where(
      and(
        isNull(pregnancyCases.deletedAt),
        eq(pregnancyCases.status, "EM_ACOMPANHAMENTO"),
        empBase,
      ),
    );

  const [hazardousWithoutRelocation] = await db
    .select({ value: count() })
    .from(pregnancyCases)
    .innerJoin(employees, eq(pregnancyCases.employeeId, employees.id))
    .where(
      and(
        isNull(pregnancyCases.deletedAt),
        eq(pregnancyCases.hazardousActivity, true),
        isNull(pregnancyCases.relocationDate),
        empBase,
      ),
    );

  const [bioAccidents] = await db
    .select({ value: count() })
    .from(biologicalAccidents)
    .innerJoin(employees, eq(biologicalAccidents.employeeId, employees.id))
    .where(and(isNull(biologicalAccidents.deletedAt), empBase));

  const [pendingFollowups] = await db
    .select({ value: count() })
    .from(biologicalAccidentFollowups)
    .innerJoin(
      biologicalAccidents,
      eq(biologicalAccidentFollowups.accidentId, biologicalAccidents.id),
    )
    .innerJoin(employees, eq(biologicalAccidents.employeeId, employees.id))
    .where(
      and(
        eq(biologicalAccidentFollowups.status, "PENDENTE"),
        isNull(biologicalAccidents.deletedAt),
        empBase,
      ),
    );

  return {
    activeEmployees: activeEmployees?.value ?? 0,
    asoOverdue: asoOverdue?.value ?? 0,
    asoDueSoon: asoDueSoon?.value ?? 0,
    asoExpectedPeriod: asoExpectedPeriod?.value ?? 0,
    asoPerformed: asoPerformed?.value ?? 0,
    activeLeaves: activeLeaves?.value ?? 0,
    pendingReturns: pendingReturns?.value ?? 0,
    pregnancies: pregnancies?.value ?? 0,
    hazardousWithoutRelocation: hazardousWithoutRelocation?.value ?? 0,
    bioAccidents: bioAccidents?.value ?? 0,
    pendingFollowups: pendingFollowups?.value ?? 0,
    configured: true,
  };
}
