import {
  and,
  count,
  desc,
  eq,
  ilike,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "@/db";
import {
  appointments,
  asoRecords,
  biologicalAccidents,
  employeeVaccinations,
  employees,
  leaveRecords,
  physicians,
  pregnancyCases,
  units,
  vaccines,
} from "@/db/schemas";
import {
  employeeScopeCondition,
  parsePage,
  parsePageSize,
  type ListResult,
} from "@/lib/scope";
import type { SessionUser } from "@/types";

function empJoinScope(user: SessionUser) {
  return employeeScopeCondition(user);
}

export async function listAsos(
  user: SessionUser,
  params: { q?: string; status?: string; type?: string; page?: string },
): Promise<
  ListResult<{
    id: string;
    registration: string;
    fullName: string;
    asoType: string;
    nextAsoDate: string | null;
    deadlineStatus: string | null;
    result: string | null;
    unitName: string | null;
  }>
> {
  const page = parsePage(params.page);
  const pageSize = parsePageSize(undefined);
  const db = getDb();
  const scope = empJoinScope(user);
  const where = and(
    isNull(asoRecords.deletedAt),
    isNull(employees.deletedAt),
    scope,
    params.status && params.status !== "ALL"
      ? eq(asoRecords.deadlineStatus, params.status)
      : undefined,
    params.type && params.type !== "ALL"
      ? eq(asoRecords.asoType, params.type)
      : undefined,
    params.q
      ? or(
          ilike(employees.fullName, `%${params.q}%`),
          ilike(employees.registration, `%${params.q}%`),
        )
      : undefined,
  );

  const [totalRow] = await db
    .select({ value: count() })
    .from(asoRecords)
    .innerJoin(employees, eq(asoRecords.employeeId, employees.id))
    .where(where);

  const rows = await db
    .select({
      id: asoRecords.id,
      registration: employees.registration,
      fullName: employees.fullName,
      asoType: asoRecords.asoType,
      nextAsoDate: asoRecords.nextAsoDate,
      deadlineStatus: asoRecords.deadlineStatus,
      result: asoRecords.result,
      unitName: units.name,
    })
    .from(asoRecords)
    .innerJoin(employees, eq(asoRecords.employeeId, employees.id))
    .leftJoin(units, eq(asoRecords.unitId, units.id))
    .where(where)
    .orderBy(desc(asoRecords.nextAsoDate))
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

export async function listAppointments(
  user: SessionUser,
  params: { q?: string; status?: string; page?: string },
) {
  const page = parsePage(params.page);
  const pageSize = parsePageSize(undefined);
  const db = getDb();
  const scope = empJoinScope(user);
  const where = and(
    isNull(appointments.deletedAt),
    isNull(employees.deletedAt),
    scope,
    params.status && params.status !== "ALL"
      ? eq(appointments.presenceStatus, params.status)
      : undefined,
    params.q
      ? or(
          ilike(employees.fullName, `%${params.q}%`),
          ilike(employees.registration, `%${params.q}%`),
        )
      : undefined,
  );

  const [totalRow] = await db
    .select({ value: count() })
    .from(appointments)
    .innerJoin(employees, eq(appointments.employeeId, employees.id))
    .where(where);

  const rows = await db
    .select({
      id: appointments.id,
      registration: employees.registration,
      fullName: employees.fullName,
      appointmentType: appointments.appointmentType,
      scheduledAt: appointments.scheduledAt,
      presenceStatus: appointments.presenceStatus,
      conduct: appointments.conduct,
      result: appointments.result,
      physicianName: physicians.name,
    })
    .from(appointments)
    .innerJoin(employees, eq(appointments.employeeId, employees.id))
    .leftJoin(physicians, eq(appointments.physicianId, physicians.id))
    .where(where)
    .orderBy(desc(appointments.scheduledAt))
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

export async function listLeaves(
  user: SessionUser,
  params: { q?: string; status?: string; page?: string },
) {
  const page = parsePage(params.page);
  const pageSize = parsePageSize(undefined);
  const db = getDb();
  const scope = empJoinScope(user);
  const where = and(
    isNull(leaveRecords.deletedAt),
    isNull(employees.deletedAt),
    scope,
    params.status && params.status !== "ALL"
      ? eq(leaveRecords.status, params.status)
      : undefined,
    params.q
      ? or(
          ilike(employees.fullName, `%${params.q}%`),
          ilike(employees.registration, `%${params.q}%`),
        )
      : undefined,
  );

  const [totalRow] = await db
    .select({ value: count() })
    .from(leaveRecords)
    .innerJoin(employees, eq(leaveRecords.employeeId, employees.id))
    .where(where);

  const rows = await db
    .select({
      id: leaveRecords.id,
      registration: employees.registration,
      fullName: employees.fullName,
      leaveType: leaveRecords.leaveType,
      startDate: leaveRecords.startDate,
      endDate: leaveRecords.endDate,
      daysCount: leaveRecords.daysCount,
      status: leaveRecords.status,
      cidCode: leaveRecords.cidCode,
      reasonSimplified: leaveRecords.reasonSimplified,
    })
    .from(leaveRecords)
    .innerJoin(employees, eq(leaveRecords.employeeId, employees.id))
    .where(where)
    .orderBy(desc(leaveRecords.startDate))
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

export async function listVaccinations(
  user: SessionUser,
  params: { q?: string; page?: string },
) {
  const page = parsePage(params.page);
  const pageSize = parsePageSize(undefined);
  const db = getDb();
  const scope = empJoinScope(user);
  const where = and(
    isNull(employeeVaccinations.deletedAt),
    isNull(employees.deletedAt),
    scope,
    params.q
      ? or(
          ilike(employees.fullName, `%${params.q}%`),
          ilike(employees.registration, `%${params.q}%`),
        )
      : undefined,
  );

  const [totalRow] = await db
    .select({ value: count() })
    .from(employeeVaccinations)
    .innerJoin(employees, eq(employeeVaccinations.employeeId, employees.id))
    .where(where);

  const rows = await db
    .select({
      id: employeeVaccinations.id,
      registration: employees.registration,
      fullName: employees.fullName,
      vaccineName: vaccines.name,
      doseNumber: employeeVaccinations.doseNumber,
      administeredAt: employeeVaccinations.administeredAt,
      status: employeeVaccinations.status,
    })
    .from(employeeVaccinations)
    .innerJoin(employees, eq(employeeVaccinations.employeeId, employees.id))
    .leftJoin(vaccines, eq(employeeVaccinations.vaccineId, vaccines.id))
    .where(where)
    .orderBy(desc(employeeVaccinations.administeredAt))
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

export async function listPregnancies(
  user: SessionUser,
  params: { q?: string; status?: string; page?: string },
) {
  const page = parsePage(params.page);
  const pageSize = parsePageSize(undefined);
  const db = getDb();
  const scope = empJoinScope(user);
  const where = and(
    isNull(pregnancyCases.deletedAt),
    isNull(employees.deletedAt),
    scope,
    params.status && params.status !== "ALL"
      ? eq(pregnancyCases.status, params.status)
      : undefined,
    params.q
      ? or(
          ilike(employees.fullName, `%${params.q}%`),
          ilike(employees.registration, `%${params.q}%`),
        )
      : undefined,
  );

  const [totalRow] = await db
    .select({ value: count() })
    .from(pregnancyCases)
    .innerJoin(employees, eq(pregnancyCases.employeeId, employees.id))
    .where(where);

  const rows = await db
    .select({
      id: pregnancyCases.id,
      registration: employees.registration,
      fullName: employees.fullName,
      status: pregnancyCases.status,
      hazardousActivity: pregnancyCases.hazardousActivity,
      relocationDate: pregnancyCases.relocationDate,
      communicationDate: pregnancyCases.communicationDate,
      originSector: pregnancyCases.originSector,
      destinationSector: pregnancyCases.destinationSector,
    })
    .from(pregnancyCases)
    .innerJoin(employees, eq(pregnancyCases.employeeId, employees.id))
    .where(where)
    .orderBy(desc(pregnancyCases.createdAt))
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

export async function listBiologicalAccidents(
  user: SessionUser,
  params: { q?: string; status?: string; page?: string },
) {
  const page = parsePage(params.page);
  const pageSize = parsePageSize(undefined);
  const db = getDb();
  const scope = empJoinScope(user);
  const where = and(
    isNull(biologicalAccidents.deletedAt),
    isNull(employees.deletedAt),
    scope,
    params.status && params.status !== "ALL"
      ? eq(biologicalAccidents.status, params.status)
      : undefined,
    params.q
      ? or(
          ilike(employees.fullName, `%${params.q}%`),
          ilike(employees.registration, `%${params.q}%`),
        )
      : undefined,
  );

  const [totalRow] = await db
    .select({ value: count() })
    .from(biologicalAccidents)
    .innerJoin(employees, eq(biologicalAccidents.employeeId, employees.id))
    .where(where);

  const rows = await db
    .select({
      id: biologicalAccidents.id,
      registration: employees.registration,
      fullName: employees.fullName,
      occurredAt: biologicalAccidents.occurredAt,
      exposureType: biologicalAccidents.exposureType,
      status: biologicalAccidents.status,
      pepStarted: biologicalAccidents.pepStarted,
      catNumber: biologicalAccidents.catNumber,
      pendingFollowups: sql<number>`(
        select count(*)::int from occupational.biological_accident_followups f
        where f.accident_id = ${biologicalAccidents.id} and f.status = 'PENDENTE'
      )`,
    })
    .from(biologicalAccidents)
    .innerJoin(employees, eq(biologicalAccidents.employeeId, employees.id))
    .where(where)
    .orderBy(desc(biologicalAccidents.occurredAt))
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

export async function findEmployeeIdByRegistration(registration: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.registration, registration.trim()),
        isNull(employees.deletedAt),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}
