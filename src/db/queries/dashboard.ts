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
  const today = new Date();
  const in30 = new Date();
  in30.setDate(today.getDate() + 30);
  const todayStr = today.toISOString().slice(0, 10);
  const in30Str = in30.toISOString().slice(0, 10);
  const monthStart = `${todayStr.slice(0, 7)}-01`;

  const [activeEmployees] = await db
    .select({ value: count() })
    .from(employees)
    .where(
      and(isNull(employees.deletedAt), eq(employees.functionalStatus, "ATIVO")),
    );

  const [asoOverdue] = await db
    .select({ value: count() })
    .from(asoRecords)
    .where(
      and(isNull(asoRecords.deletedAt), eq(asoRecords.deadlineStatus, "VENCIDO")),
    );

  const [asoDueSoon] = await db
    .select({ value: count() })
    .from(asoRecords)
    .where(
      and(
        isNull(asoRecords.deletedAt),
        eq(asoRecords.deadlineStatus, "A_VENCER"),
        gte(asoRecords.nextAsoDate, todayStr),
        lte(asoRecords.nextAsoDate, in30Str),
      ),
    );

  const [asoExpectedPeriod] = await db
    .select({ value: count() })
    .from(asoRecords)
    .where(
      and(
        isNull(asoRecords.deletedAt),
        gte(asoRecords.expectedDate, todayStr),
        lte(asoRecords.expectedDate, in30Str),
      ),
    );

  const [asoPerformed] = await db
    .select({ value: count() })
    .from(asoRecords)
    .where(
      and(
        isNull(asoRecords.deletedAt),
        gte(asoRecords.performedDate, monthStart),
      ),
    );

  const [activeLeaves] = await db
    .select({ value: count() })
    .from(leaveRecords)
    .where(
      and(isNull(leaveRecords.deletedAt), eq(leaveRecords.status, "ATIVO")),
    );

  const [pregnancies] = await db
    .select({ value: count() })
    .from(pregnancyCases)
    .where(
      and(
        isNull(pregnancyCases.deletedAt),
        eq(pregnancyCases.status, "EM_ACOMPANHAMENTO"),
      ),
    );

  const [hazardousWithoutRelocation] = await db
    .select({ value: count() })
    .from(pregnancyCases)
    .where(
      and(
        isNull(pregnancyCases.deletedAt),
        eq(pregnancyCases.hazardousActivity, true),
        isNull(pregnancyCases.relocationDate),
      ),
    );

  const [bioAccidents] = await db
    .select({ value: count() })
    .from(biologicalAccidents)
    .where(isNull(biologicalAccidents.deletedAt));

  const [pendingFollowups] = await db
    .select({ value: count() })
    .from(biologicalAccidentFollowups)
    .where(eq(biologicalAccidentFollowups.status, "PENDENTE"));

  return {
    activeEmployees: activeEmployees?.value ?? 0,
    asoOverdue: asoOverdue?.value ?? 0,
    asoDueSoon: asoDueSoon?.value ?? 0,
    asoExpectedPeriod: asoExpectedPeriod?.value ?? 0,
    asoPerformed: asoPerformed?.value ?? 0,
    activeLeaves: activeLeaves?.value ?? 0,
    pendingReturns: 0,
    pregnancies: pregnancies?.value ?? 0,
    hazardousWithoutRelocation: hazardousWithoutRelocation?.value ?? 0,
    bioAccidents: bioAccidents?.value ?? 0,
    pendingFollowups: pendingFollowups?.value ?? 0,
    configured: true,
  };
}
