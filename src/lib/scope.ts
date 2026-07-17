import { and, eq, inArray, isNull, type SQL } from "drizzle-orm";
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
