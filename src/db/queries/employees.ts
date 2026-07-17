import { and, count, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  employees,
  jobRoles,
  regions,
  units,
} from "@/db/schemas";
import { can } from "@/lib/permissions";
import { resolveCpfDisplayResult } from "@/lib/employees/cpf-display";
import {
  employeeScopeCondition,
  parsePage,
  parsePageSize,
  type ListResult,
} from "@/lib/scope";
import type { SessionUser } from "@/types";

export type EmployeeListItem = {
  id: string;
  registration: string;
  fullName: string;
  functionalStatus: string;
  unitName: string | null;
  regionName: string | null;
  regionId: string | null;
  unitId: string | null;
  jobRoleName: string | null;
  city: string | null;
  admissionDate: string | null;
};

export type EmployeeListParams = {
  q?: string;
  status?: string;
  regionId?: string;
  unitId?: string;
  page?: string;
};

export async function listEmployees(
  user: SessionUser,
  params: EmployeeListParams,
): Promise<
  ListResult<EmployeeListItem> & {
    filterLabel?: string;
    appliedRegionId?: string;
    appliedUnitId?: string;
  }
> {
  const page = parsePage(params.page);
  const pageSize = parsePageSize(undefined);
  const db = getDb();
  const scope = employeeScopeCondition(user);

  let regionId = params.regionId?.trim() || "";
  let unitId = params.unitId?.trim() || "";
  if (regionId === "ALL") regionId = "";
  if (unitId === "ALL") unitId = "";

  // Escopo: usuário UNIT não pode ampliar via URL
  if (user.scopeLevel === "UNIT") {
    if (user.unitIds.length === 1) unitId = user.unitIds[0];
    else if (unitId && !user.unitIds.includes(unitId)) unitId = "";
    regionId = "";
  } else if (user.scopeLevel === "REGION") {
    if (regionId && !user.regionIds.includes(regionId)) regionId = "";
    if (!regionId && user.regionIds.length === 1) regionId = user.regionIds[0];
  }

  // Unidade deve pertencer à regional filtrada
  if (unitId && regionId) {
    const [u] = await db
      .select({ regionId: units.regionId })
      .from(units)
      .where(and(eq(units.id, unitId), isNull(units.deletedAt)))
      .limit(1);
    if (!u || u.regionId !== regionId) unitId = "";
  }

  const filters = [
    isNull(employees.deletedAt),
    scope,
    params.status && params.status !== "ALL"
      ? eq(employees.functionalStatus, params.status)
      : undefined,
    regionId ? eq(employees.regionId, regionId) : undefined,
    unitId ? eq(employees.unitId, unitId) : undefined,
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
      regionId: employees.regionId,
      unitId: employees.unitId,
      unitName: units.name,
      regionName: regions.name,
      jobRoleName: jobRoles.name,
    })
    .from(employees)
    .leftJoin(units, eq(employees.unitId, units.id))
    .leftJoin(regions, eq(employees.regionId, regions.id))
    .leftJoin(jobRoles, eq(employees.jobRoleId, jobRoles.id))
    .where(where)
    .orderBy(regions.name, units.name, employees.fullName)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  let filterLabel: string | undefined;
  if (regionId) {
    const [r] = await db
      .select({ name: regions.name })
      .from(regions)
      .where(eq(regions.id, regionId))
      .limit(1);
    if (r?.name) filterLabel = `na Regional ${r.name}`;
  }

  const total = totalRow?.value ?? 0;
  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    filterLabel,
    appliedRegionId: regionId || undefined,
    appliedUnitId: unitId || undefined,
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

  if (!row) return null;

  const showSensitive = can(user, "employees", "view_sensitive_identifiers");
  const cpfResult = resolveCpfDisplayResult(
    row.employee.cpfEncrypted,
    row.employee.cpfHash,
    showSensitive,
  );

  if (
    cpfResult.diagnostic === "CPF_DECRYPTION_ERROR" ||
    cpfResult.diagnostic === "CPF_HASH_ONLY"
  ) {
    // Diagnóstico seguro no servidor — sem CPF/plaintext.
    console.info("[cpf-display]", {
      diagnostic: cpfResult.diagnostic,
      employeeId: row.employee.id,
      hasEncrypted: Boolean(row.employee.cpfEncrypted),
      hasHash: Boolean(row.employee.cpfHash),
      canViewSensitive: showSensitive,
    });
  }

  return {
    ...row,
    cpfDisplay: cpfResult.display,
    cpfStatus: cpfResult.status,
    cpfDiagnostic: cpfResult.diagnostic,
    canViewSensitive: showSensitive,
  };
}

export async function listRegionsForUser(user: SessionUser) {
  const db = getDb();
  const base = and(isNull(regions.deletedAt), eq(regions.isActive, true));
  if (user.scopeLevel === "EMSERH") {
    return db.select().from(regions).where(base).orderBy(regions.name);
  }
  if (user.scopeLevel === "REGION") {
    if (!user.regionIds.length) return [];
    return db
      .select()
      .from(regions)
      .where(and(base, inArray(regions.id, user.regionIds)))
      .orderBy(regions.name);
  }
  // UNIT: regionais das unidades do usuário
  if (!user.unitIds.length) return [];
  const unitRows = await db
    .select({ regionId: units.regionId })
    .from(units)
    .where(and(isNull(units.deletedAt), inArray(units.id, user.unitIds)));
  const ids = [
    ...new Set(unitRows.map((u) => u.regionId).filter(Boolean) as string[]),
  ];
  if (!ids.length) return [];
  return db
    .select()
    .from(regions)
    .where(and(base, inArray(regions.id, ids)))
    .orderBy(regions.name);
}

export async function listUnitsForUser(user: SessionUser, regionId?: string) {
  const db = getDb();
  const filters = [isNull(units.deletedAt), eq(units.isActive, true)];

  if (user.scopeLevel === "UNIT") {
    if (!user.unitIds.length) return [];
    filters.push(inArray(units.id, user.unitIds));
  } else if (user.scopeLevel === "REGION") {
    if (!user.regionIds.length) return [];
    filters.push(inArray(units.regionId, user.regionIds));
  }

  if (regionId && regionId !== "ALL") {
    if (user.scopeLevel === "REGION" && !user.regionIds.includes(regionId)) {
      return [];
    }
    filters.push(eq(units.regionId, regionId));
  }

  return db
    .select({
      id: units.id,
      name: units.name,
      city: units.city,
      regionId: units.regionId,
      regionCode: regions.code,
      regionName: regions.name,
    })
    .from(units)
    .leftJoin(regions, eq(units.regionId, regions.id))
    .where(and(...filters))
    .orderBy(units.name);
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
    .select({
      id: units.id,
      name: units.name,
      city: units.city,
      regionId: units.regionId,
      regionCode: regions.code,
      regionName: regions.name,
    })
    .from(units)
    .leftJoin(regions, eq(units.regionId, regions.id))
    .where(
      and(
        isNull(units.deletedAt),
        eq(units.isActive, true),
        regionId ? eq(units.regionId, regionId) : undefined,
      ),
    )
    .orderBy(regions.code, units.name);
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
    { code: "CENTRO", name: "Centro" },
  ];

  for (const r of defaults) {
    await db.insert(regions).values({
      ...r,
      createdBy: userId,
      updatedBy: userId,
    });
  }
}
