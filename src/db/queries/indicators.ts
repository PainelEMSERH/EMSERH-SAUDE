import { and, count, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import {
  ambulatoryAttendances,
  employees,
  indicatorDefinitions,
} from "@/db/schemas";
import {
  employeeScopeCondition,
  parsePage,
  parsePageSize,
} from "@/lib/scope";
import type { SessionUser } from "@/types";

export async function listAttendances(
  user: SessionUser,
  params: { q?: string; page?: string },
) {
  const page = parsePage(params.page);
  const pageSize = parsePageSize(undefined);
  const db = getDb();
  const scope = employeeScopeCondition(user);
  const where = and(
    isNull(ambulatoryAttendances.deletedAt),
    scope,
  );

  const [totalRow] = await db
    .select({ value: count() })
    .from(ambulatoryAttendances)
    .leftJoin(employees, eq(ambulatoryAttendances.employeeId, employees.id))
    .where(where);

  const rows = await db
    .select({
      id: ambulatoryAttendances.id,
      registration: employees.registration,
      fullName: employees.fullName,
      attendanceType: ambulatoryAttendances.attendanceType,
      attendedAt: ambulatoryAttendances.attendedAt,
      conduct: ambulatoryAttendances.conduct,
    })
    .from(ambulatoryAttendances)
    .leftJoin(employees, eq(ambulatoryAttendances.employeeId, employees.id))
    .where(where)
    .orderBy(desc(ambulatoryAttendances.attendedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const total = totalRow?.value ?? 0;
  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listIndicators() {
  const db = getDb();
  return db
    .select()
    .from(indicatorDefinitions)
    .where(and(isNull(indicatorDefinitions.deletedAt), eq(indicatorDefinitions.isActive, true)))
    .orderBy(indicatorDefinitions.category, indicatorDefinitions.code);
}
