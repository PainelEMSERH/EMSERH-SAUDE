"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schemas";
import { writeAuditLog } from "@/lib/audit";
import {
  countRecentFailures,
  createSessionToken,
  recordLoginAttempt,
  revokeCurrentSession,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth/session";
import { isAuthConfigured, isDatabaseConfigured } from "@/lib/env";

const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres."),
});

export type LoginState = {
  error?: string;
  ok?: boolean;
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isDatabaseConfigured() || !isAuthConfigured()) {
    return {
      error:
        "Sistema ainda sem Neon/AUTH_SECRET configurados. Configure o ambiente antes do login.",
    };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const password = parsed.data.password;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = h.get("user-agent");

  const failures = await countRecentFailures(email);
  if (failures >= 8) {
    await recordLoginAttempt({
      email,
      success: false,
      ipAddress: ip,
      userAgent: ua,
      reason: "rate_limited",
    });
    return {
      error: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    };
  }

  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !user.isActive || user.deletedAt) {
    await recordLoginAttempt({
      email,
      success: false,
      ipAddress: ip,
      userAgent: ua,
      reason: "invalid_credentials",
    });
    return { error: "Credenciais inválidas." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await recordLoginAttempt({
      email,
      success: false,
      ipAddress: ip,
      userAgent: ua,
      reason: "invalid_credentials",
    });
    return { error: "Credenciais inválidas." };
  }

  const { token, expiresAt } = await createSessionToken(user.id);
  await setSessionCookie(token, expiresAt);
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  await recordLoginAttempt({
    email,
    success: true,
    ipAddress: ip,
    userAgent: ua,
  });
  await writeAuditLog({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as never,
      scopeLevel: user.scopeLevel as never,
      regionIds: [],
      unitIds: [],
    },
    action: "LOGIN",
    entityType: "user",
    entityId: user.id,
    ipAddress: ip,
    userAgent: ua,
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  await revokeCurrentSession();
  redirect("/login");
}
