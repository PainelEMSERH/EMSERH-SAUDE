"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schemas";
import { assignableRoles } from "@/lib/admin/roles";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import {
  hashPassword,
  revokeAllUserSessions,
} from "@/lib/auth/session";
import { scopeLevelForRole } from "@/lib/permissions";
import type { UserRole } from "@/types";

export type AdminActionState = {
  error?: string;
  ok?: boolean;
  message?: string;
};

const roleSchema = z.enum([
  "SUPER_ADMIN",
  "ADMIN_CENTRAL",
  "COORDENACAO_REGIONAL",
  "OPERADOR_UNIDADE",
  "MEDICO_TRABALHO",
  "ENFERMAGEM_TRABALHO",
  "GESTOR_CONSULTA",
  "AUDITOR",
]);

function canMutateTarget(
  actorRole: UserRole,
  targetRole: string,
): boolean {
  if (actorRole === "SUPER_ADMIN") return true;
  if (targetRole === "SUPER_ADMIN") return false;
  return assignableRoles(actorRole).length > 0;
}

export async function createUserAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const actor = await requirePermission("admin", "create");
    const allowed = assignableRoles(actor.role);
    if (!allowed.length) {
      return { error: "Seu perfil não pode criar usuários." };
    }

    const parsed = z
      .object({
        name: z.string().trim().min(2).max(120),
        email: z.string().trim().email().max(180),
        password: z.string().min(8).max(128),
        role: roleSchema,
      })
      .safeParse({
        name: formData.get("name"),
        email: String(formData.get("email") ?? "").toLowerCase(),
        password: formData.get("password"),
        role: formData.get("role"),
      });

    if (!parsed.success) {
      return { error: "Preencha nome, e-mail válido, senha (≥8) e perfil." };
    }

    const { name, email, password, role } = parsed.data;
    if (!allowed.includes(role)) {
      return { error: "Você não pode atribuir este perfil." };
    }

    const db = getDb();
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    if (existing) {
      return { error: "Já existe um usuário com este e-mail." };
    }

    const passwordHash = await hashPassword(password);
    const [created] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash,
        role,
        scopeLevel: scopeLevelForRole(role),
        isActive: true,
        mustResetPassword: true,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning({ id: users.id, email: users.email, role: users.role });

    await writeAuditLog({
      user: actor,
      action: "CREATE_USER",
      entityType: "user",
      entityId: created.id,
      afterData: { email: created.email, role: created.role },
    });

    revalidatePath("/administracao");
    return { ok: true, message: `Usuário ${email} criado.` };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Falha ao criar usuário.",
    };
  }
}

export async function updateUserRoleAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const actor = await requirePermission("admin", "update");
    const allowed = assignableRoles(actor.role);

    const parsed = z
      .object({
        userId: z.string().uuid(),
        role: roleSchema,
      })
      .safeParse({
        userId: formData.get("userId"),
        role: formData.get("role"),
      });

    if (!parsed.success) return { error: "Dados inválidos." };
    if (parsed.data.userId === actor.id) {
      return { error: "Você não pode alterar o próprio perfil." };
    }
    if (!allowed.includes(parsed.data.role)) {
      return { error: "Você não pode atribuir este perfil." };
    }

    const db = getDb();
    const [target] = await db
      .select()
      .from(users)
      .where(
        and(eq(users.id, parsed.data.userId), isNull(users.deletedAt)),
      )
      .limit(1);
    if (!target) return { error: "Usuário não encontrado." };
    if (!canMutateTarget(actor.role, target.role)) {
      return { error: "Você não pode alterar este usuário." };
    }

    await db
      .update(users)
      .set({
        role: parsed.data.role,
        scopeLevel: scopeLevelForRole(parsed.data.role),
        updatedBy: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(users.id, target.id));

    await writeAuditLog({
      user: actor,
      action: "UPDATE_USER_ROLE",
      entityType: "user",
      entityId: target.id,
      beforeData: { role: target.role },
      afterData: { role: parsed.data.role },
    });

    revalidatePath("/administracao");
    return { ok: true, message: "Perfil atualizado." };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Falha ao atualizar perfil.",
    };
  }
}

export async function setUserActiveAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const actor = await requirePermission("admin", "manage");
    const parsed = z
      .object({
        userId: z.string().uuid(),
        active: z.enum(["true", "false"]),
      })
      .safeParse({
        userId: formData.get("userId"),
        active: formData.get("active"),
      });

    if (!parsed.success) return { error: "Dados inválidos." };
    if (parsed.data.userId === actor.id) {
      return { error: "Você não pode desativar a própria conta." };
    }

    const db = getDb();
    const [target] = await db
      .select()
      .from(users)
      .where(
        and(eq(users.id, parsed.data.userId), isNull(users.deletedAt)),
      )
      .limit(1);
    if (!target) return { error: "Usuário não encontrado." };
    if (!canMutateTarget(actor.role, target.role)) {
      return { error: "Você não pode alterar este usuário." };
    }

    const isActive = parsed.data.active === "true";
    await db
      .update(users)
      .set({
        isActive,
        updatedBy: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(users.id, target.id));

    if (!isActive) {
      await revokeAllUserSessions(target.id);
    }

    await writeAuditLog({
      user: actor,
      action: isActive ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      entityType: "user",
      entityId: target.id,
      afterData: { isActive, email: target.email },
    });

    revalidatePath("/administracao");
    return {
      ok: true,
      message: isActive ? "Usuário reativado." : "Usuário desativado.",
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Falha ao alterar status.",
    };
  }
}

export async function resetUserPasswordAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const actor = await requirePermission("admin", "manage");
    const parsed = z
      .object({
        userId: z.string().uuid(),
        password: z.string().min(8).max(128),
      })
      .safeParse({
        userId: formData.get("userId"),
        password: formData.get("password"),
      });

    if (!parsed.success) {
      return { error: "Informe uma senha com pelo menos 8 caracteres." };
    }

    const db = getDb();
    const [target] = await db
      .select()
      .from(users)
      .where(
        and(eq(users.id, parsed.data.userId), isNull(users.deletedAt)),
      )
      .limit(1);
    if (!target) return { error: "Usuário não encontrado." };
    if (!canMutateTarget(actor.role, target.role)) {
      return { error: "Você não pode alterar este usuário." };
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await db
      .update(users)
      .set({
        passwordHash,
        mustResetPassword: true,
        updatedBy: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(users.id, target.id));

    await revokeAllUserSessions(target.id);

    await writeAuditLog({
      user: actor,
      action: "RESET_USER_PASSWORD",
      entityType: "user",
      entityId: target.id,
      afterData: { email: target.email },
    });

    revalidatePath("/administracao");
    return {
      ok: true,
      message: "Senha redefinida. Sessões ativas foram encerradas.",
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Falha ao redefinir senha.",
    };
  }
}
