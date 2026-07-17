import { and, eq, inArray, isNull, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { employees } from "@/db/schemas";
import type { SessionUser } from "@/types";

/** Aplica escopo regional/unidade em consultas de colaboradores. */
export function employeeScopeCondition(user: SessionUser): SQL | undefined {
  if (user.scopeLevel === "EMSERH") return undefined;
  if (user.scopeLevel === "REGION") {
    if (!user.regionIds.length) return eq(employees.id, "00000000-0000-0000-0000-000000000000");
    return inArray(employees.regionId, user.regionIds);
  }
  if (!user.unitIds.length) {
    return eq(employees.id, "00000000-0000-0000-0000-000000000000");
  }
  return inArray(employees.unitId, user.unitIds);
}

/**
 * Busca colaborador no escopo do usuário.
 * Fora do escopo: mesma mensagem genérica (não revela existência em outra regional).
 */
export async function requireEmployeeInUserScope(
  user: SessionUser,
  opts: { employeeId?: string; registration?: string },
): Promise<{ id: string }> {
  const db = getDb();
  const scope = employeeScopeCondition(user);
  const id = opts.employeeId?.trim();
  const registration = opts.registration?.trim();

  if (!id && !registration) {
    throw new Error("Colaborador não encontrado.");
  }

  const identity = id
    ? eq(employees.id, id)
    : eq(employees.registration, registration!);

  const [row] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(identity, isNull(employees.deletedAt), scope))
    .limit(1);

  if (!row) {
    throw new Error("Colaborador não encontrado.");
  }
  return row;
}

/** Valida se regionId/unitId informados estão no escopo do usuário. */
export function assertOrgIdsInUserScope(
  user: SessionUser,
  opts: { regionId?: string | null; unitId?: string | null },
): void {
  if (user.scopeLevel === "EMSERH") return;
  if (user.scopeLevel === "REGION") {
    if (opts.regionId && !user.regionIds.includes(opts.regionId)) {
      throw new Error("Regional fora do seu escopo.");
    }
    return;
  }
  if (opts.unitId && !user.unitIds.includes(opts.unitId)) {
    throw new Error("Unidade fora do seu escopo.");
  }
}

export function withNotDeleted(...conditions: Array<SQL | undefined>) {
  return and(isNull(employees.deletedAt), ...conditions.filter(Boolean));
}

export function parsePage(value: string | undefined, fallback = 1): number {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function parsePageSize(value: string | undefined, fallback = 20): number {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n) || n < 5) return fallback;
  return Math.min(Math.floor(n), 100);
}

export type ListResult<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
