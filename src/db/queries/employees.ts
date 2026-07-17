import { and, count, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  employees,
  jobRoles,
  regions,
  units,
} from "@/db/schemas";
import { can } from "@/lib/permissions";
import {
  employeeScopeCondition,
  parsePage,
  parsePageSize,
  type ListResult,
} from "@/lib/scope";
import { maskCpf } from "@/lib/encryption";
import type { SessionUser } from "@/types";

export type EmployeeListItem = {
  id: string;
  registration: string;
  fullName: string;
  functionalStatus: string;
  unitName: string | null;
  regionName: string | null;
  jobRoleName: string | null;
  city: string | null;
  admissionDate: string | null;
  cpfDisplay: string;
};

export async function listEmployees(
  user: SessionUser,
  params: { q?: string; status?: string; page?: string },
): Promise<ListResult<EmployeeListItem>> {
  const page = parsePage(params.page);
  const pageSize = parsePageSize(undefined);
  const db = getDb();
  const scope = employeeScopeCondition(user);

  const filters = [
    isNull(employees.deletedAt),
    scope,
    params.status && params.status !== "ALL"
      ? eq(employees.functionalStatus, params.status)
      : undefined,
    params.q
      ? or(
          ilike(employees.fullName, `%${params.q}%`),
          ilike(employees.registration, `%${params.q}%`),
          ilike(employees.normalizedName, `%${params.q.toUpperCase()}%`),
        )
      : undefined,
  ];

  const where = and(...filters.filter(Boolean));

  const [totalRow] = await db
    .select({ value: count() })
    .from(employees)
    .where(where);

  const rows = await db
    .select({
      id: employees.id,
      registration: employees.registration,
      fullName: employees.fullName,
      functionalStatus: employees.functionalStatus,
      city: employees.city,
      admissionDate: employees.admissionDate,
      cpfEncrypted: employees.cpfEncrypted,
      unitName: units.name,
      regionName: regions.name,
      jobRoleName: jobRoles.name,
    })
    .from(employees)
    .leftJoin(units, eq(employees.unitId, units.id))
    .leftJoin(regions, eq(employees.regionId, regions.id))
    .leftJoin(jobRoles, eq(employees.jobRoleId, jobRoles.id))
    .where(where)
    .orderBy(desc(employees.updatedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const showSensitive = can(user, "employees", "view_sensitive_identifiers");

  const mapped: EmployeeListItem[] = rows.map((r) => ({
    id: r.id,
    registration: r.registration,
    fullName: r.fullName,
    functionalStatus: r.functionalStatus,
    unitName: r.unitName,
    regionName: r.regionName,
    jobRoleName: r.jobRoleName,
    city: r.city,
    admissionDate: r.admissionDate,
    cpfDisplay: showSensitive
      ? r.cpfEncrypted
        ? "[protegido]"
        : "—"
      : maskCpf(null),
  }));

  const total = totalRow?.value ?? 0;
  return {
    rows: mapped,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getEmployeeById(user: SessionUser, id: string) {
  const db = getDb();
  const scope = employeeScopeCondition(user);
  const [row] = await db
    .select({
      employee: employees,
      unitName: units.name,
      regionName: regions.name,
      jobRoleName: jobRoles.name,
    })
    .from(employees)
    .leftJoin(units, eq(employees.unitId, units.id))
    .leftJoin(regions, eq(employees.regionId, regions.id))
    .leftJoin(jobRoles, eq(employees.jobRoleId, jobRoles.id))
    .where(and(eq(employees.id, id), isNull(employees.deletedAt), scope))
    .limit(1);
  return row ?? null;
}

export async function listRegions() {
  const db = getDb();
  return db
    .select()
    .from(regions)
    .where(and(isNull(regions.deletedAt), eq(regions.isActive, true)))
    .orderBy(regions.name);
}

export async function listUnits(regionId?: string) {
  const db = getDb();
  return db
    .select()
    .from(units)
    .where(
      and(
        isNull(units.deletedAt),
        eq(units.isActive, true),
        regionId ? eq(units.regionId, regionId) : undefined,
      ),
    )
    .orderBy(units.name);
}

export async function listJobRoles() {
  const db = getDb();
  return db
    .select()
    .from(jobRoles)
    .where(and(isNull(jobRoles.deletedAt), eq(jobRoles.isActive, true)))
    .orderBy(jobRoles.name);
}

export async function ensureOrgDefaults(userId: string) {
  const db = getDb();
  const existing = await db.select({ id: regions.id }).from(regions).limit(1);
  if (existing.length) return;

  const defaults = [
    { code: "NORTE", name: "Norte" },
    { code: "SUL", name: "Sul" },
    { code: "LESTE", name: "Leste" },
    { code: "OESTE", name: "Oeste" },
    { code: "CENTRAL", name: "Central" },
  ];

  for (const r of defaults) {
    await db.insert(regions).values({
      ...r,
      createdBy: userId,
      updatedBy: userId,
    });
  }
}
