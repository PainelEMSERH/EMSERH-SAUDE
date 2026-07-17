import { and, desc, eq, gte, ilike, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, loginAttempts, users } from "@/db/schemas";

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  scopeLevel: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date | null;
  mustResetPassword: boolean;
};

export async function listAdminUsers(params?: {
  q?: string;
  role?: string;
  active?: "all" | "active" | "inactive";
}): Promise<AdminUserRow[]> {
  const db = getDb();
  const filters = [isNull(users.deletedAt)];

  const q = params?.q?.trim();
  if (q) {
    filters.push(
      or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`))!,
    );
  }
  if (params?.role && params.role !== "ALL") {
    filters.push(eq(users.role, params.role));
  }
  if (params?.active === "active") filters.push(eq(users.isActive, true));
  if (params?.active === "inactive") filters.push(eq(users.isActive, false));

  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      scopeLevel: users.scopeLevel,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      mustResetPassword: users.mustResetPassword,
    })
    .from(users)
    .where(and(...filters))
    .orderBy(users.name);
}

export type AuditLogRow = {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: Date | null;
  metadata: unknown;
};

export async function listAuditLogs(params?: {
  q?: string;
  action?: string;
  limit?: number;
}): Promise<AuditLogRow[]> {
  const db = getDb();
  const limit = Math.min(params?.limit ?? 80, 200);
  const filters = [];

  if (params?.action && params.action !== "ALL") {
    filters.push(eq(auditLogs.action, params.action));
  }
  const q = params?.q?.trim();
  if (q) {
    filters.push(
      or(
        ilike(auditLogs.action, `%${q}%`),
        ilike(auditLogs.entityType, `%${q}%`),
        ilike(auditLogs.entityId, `%${q}%`),
        ilike(users.name, `%${q}%`),
        ilike(users.email, `%${q}%`),
      )!,
    );
  }

  const rows = await db
    .select({
      id: auditLogs.id,
      userId: auditLogs.userId,
      userName: users.name,
      userEmail: users.email,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      createdAt: auditLogs.createdAt,
      metadata: auditLogs.metadata,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return rows;
}

export async function listDistinctAuditActions(): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .selectDistinct({ action: auditLogs.action })
    .from(auditLogs)
    .orderBy(auditLogs.action);
  return rows.map((r) => r.action).filter(Boolean);
}

export type LoginAttemptRow = {
  id: string;
  email: string;
  success: boolean;
  reason: string | null;
  ipAddress: string | null;
  createdAt: Date | null;
};

export async function listRecentLoginAttempts(
  limit = 40,
): Promise<LoginAttemptRow[]> {
  const db = getDb();
  return db
    .select({
      id: loginAttempts.id,
      email: loginAttempts.email,
      success: loginAttempts.success,
      reason: loginAttempts.reason,
      ipAddress: loginAttempts.ipAddress,
      createdAt: loginAttempts.createdAt,
    })
    .from(loginAttempts)
    .orderBy(desc(loginAttempts.createdAt))
    .limit(limit);
}

export async function countActiveUsers(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(and(isNull(users.deletedAt), eq(users.isActive, true)));
  return row?.n ?? 0;
}

export async function countAuditLast24h(): Promise<number> {
  const db = getDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(gte(auditLogs.createdAt, since));
  return row?.n ?? 0;
}
