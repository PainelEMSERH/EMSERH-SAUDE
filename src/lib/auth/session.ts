import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import {
  loginAttempts,
  sessions,
  userRegionScopes,
  userUnitScopes,
  users,
} from "@/db/schemas";
import { isAuthConfigured, requireAuthSecret } from "@/lib/env";
import { scopeLevelForRole } from "@/lib/permissions";
import type { SessionUser, UserRole } from "@/types";

export const SESSION_COOKIE = "emserh_so_session";
const SESSION_DAYS = 8;

function secretKey() {
  return new TextEncoder().encode(requireAuthSecret());
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(userId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  const db = getDb();
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  const jwt = await new SignJWT({ sid: hashToken(token), sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());

  return { token: jwt, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  if (!user || !user.isActive) return null;

  const regions = await db
    .select()
    .from(userRegionScopes)
    .where(eq(userRegionScopes.userId, user.id));
  const units = await db
    .select()
    .from(userUnitScopes)
    .where(eq(userUnitScopes.userId, user.id));

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserRole,
    scopeLevel:
      (user.scopeLevel as SessionUser["scopeLevel"]) ||
      scopeLevelForRole(user.role as UserRole),
    regionIds: regions.map((r) => r.regionId),
    unitIds: units.map((u) => u.unitId),
  };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  if (!isAuthConfigured() || !process.env.DATABASE_URL) return null;

  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, secretKey());
    const userId = payload.sub;
    const tokenHash = payload.sid;
    if (!userId || typeof tokenHash !== "string") return null;

    const db = getDb();
    const [session] = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!session) return null;
    return loadSessionUser(userId);
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Não autenticado.");
  }
  return user;
}

export async function recordLoginAttempt(input: {
  email: string;
  success: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  reason?: string;
}) {
  if (!process.env.DATABASE_URL) return;
  const db = getDb();
  await db.insert(loginAttempts).values({
    email: input.email.toLowerCase(),
    success: input.success,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    reason: input.reason ?? null,
  });
}

export async function countRecentFailures(
  email: string,
  windowMinutes = 15,
): Promise<number> {
  if (!process.env.DATABASE_URL) return 0;
  const db = getDb();
  const since = new Date(Date.now() - windowMinutes * 60_000);
  const rows = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.email, email.toLowerCase()));
  return rows.filter(
    (r) => !r.success && r.createdAt && r.createdAt >= since,
  ).length;
}

export async function revokeCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || !process.env.DATABASE_URL) {
    await clearSessionCookie();
    return;
  }
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sid === "string") {
      const db = getDb();
      await db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.tokenHash, payload.sid));
    }
  } catch {
    // ignore invalid token on logout
  }
  await clearSessionCookie();
}

/** Revoga todas as sessões ativas de um usuário (ex.: desativação). */
export async function revokeAllUserSessions(userId: string) {
  if (!process.env.DATABASE_URL) return;
  const db = getDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
