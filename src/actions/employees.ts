"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { employees, jobRoles, regions, units } from "@/db/schemas";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { encryptField, hashCpf, normalizeCpf } from "@/lib/encryption";
import { getEnv } from "@/lib/env";
import {
  assertOrgIdsInUserScope,
  requireEmployeeInUserScope,
} from "@/lib/scope";
import { normalizeText, registrationSchema } from "@/lib/validation";
import { z } from "zod";

const NEW_JOB_ROLE = "__NEW__";

const employeeSchema = z.object({
  registration: registrationSchema,
  fullName: z.string().trim().min(3).max(200),
  cpf: z.string().optional(),
  sex: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  admissionDate: z.string().optional(),
  functionalStatus: z.string().default("ATIVO"),
  regionId: z.string().uuid().optional().or(z.literal("")),
  unitId: z.string().uuid().optional().or(z.literal("")),
  jobRoleId: z.string().optional(),
  jobRoleName: z.string().optional(),
});

export type ActionState = { error?: string; ok?: boolean; id?: string };

export async function upsertEmployeeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") || "");
  const user = id
    ? await requirePermission("employees", "update")
    : await requirePermission("employees", "create");

  const parsed = employeeSchema.safeParse({
    registration: formData.get("registration"),
    fullName: formData.get("fullName"),
    cpf: formData.get("cpf") || undefined,
    sex: formData.get("sex") || undefined,
    phone: formData.get("phone") || undefined,
    city: formData.get("city") || undefined,
    admissionDate: formData.get("admissionDate") || undefined,
    functionalStatus: formData.get("functionalStatus") || "ATIVO",
    regionId: formData.get("regionId") || "",
    unitId: formData.get("unitId") || "",
    jobRoleId: formData.get("jobRoleId") || "",
    jobRoleName: formData.get("jobRoleName") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const data = parsed.data;
  try {
    assertOrgIdsInUserScope(user, {
      regionId: data.regionId || null,
      unitId: data.unitId || null,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Escopo inválido." };
  }

  const db = getDb();
  const regionId = data.regionId || null;
  const unitId = data.unitId || null;

  if (unitId) {
    const [unit] = await db
      .select({ id: units.id, regionId: units.regionId })
      .from(units)
      .where(and(eq(units.id, unitId), isNull(units.deletedAt)))
      .limit(1);
    if (!unit) return { error: "Unidade inválida." };
    if (regionId && unit.regionId !== regionId) {
      return { error: "Unidade não pertence à regional selecionada." };
    }
  }

  // Função: existente XOR nova
  let jobRoleId: string | null = null;
  const roleSelect = (data.jobRoleId || "").trim();
  const roleName = (data.jobRoleName || "").trim();

  if (roleSelect && roleSelect !== NEW_JOB_ROLE) {
    const [existingRole] = await db
      .select({ id: jobRoles.id })
      .from(jobRoles)
      .where(and(eq(jobRoles.id, roleSelect), isNull(jobRoles.deletedAt)))
      .limit(1);
    if (!existingRole) return { error: "Função inválida." };
    jobRoleId = existingRole.id;
  } else if (roleName) {
    const normalized = normalizeText(roleName);
    const [existing] = await db
      .select({ id: jobRoles.id })
      .from(jobRoles)
      .where(eq(jobRoles.normalizedName, normalized))
      .limit(1);
    if (existing) {
      jobRoleId = existing.id;
    } else {
      const [created] = await db
        .insert(jobRoles)
        .values({
          name: roleName,
          normalizedName: normalized,
        })
        .returning({ id: jobRoles.id });
      jobRoleId = created.id;
    }
  }

  const cpfRaw = data.cpf?.trim() || "";
  let cpfUpdate: { cpfEncrypted: string | null; cpfHash: string | null } | null =
    null;
  if (cpfRaw) {
    const digits = normalizeCpf(cpfRaw);
    if (digits.length !== 11) return { error: "CPF inválido." };
    cpfUpdate = {
      cpfHash: hashCpf(digits),
      cpfEncrypted: getEnv().FIELD_ENCRYPTION_KEY
        ? encryptField(digits)
        : null,
    };
  }

  const basePayload = {
    registration: data.registration.trim(),
    fullName: data.fullName.trim(),
    normalizedName: normalizeText(data.fullName),
    sex: data.sex || null,
    phone: data.phone || null,
    city: data.city || null,
    admissionDate: data.admissionDate || null,
    functionalStatus: data.functionalStatus,
    regionId,
    unitId,
    jobRoleId,
    updatedBy: user.id,
  };

  if (id) {
    try {
      await requireEmployeeInUserScope(user, { employeeId: id });
    } catch {
      return { error: "Colaborador não encontrado." };
    }
    const [before] = await db
      .select()
      .from(employees)
      .where(and(eq(employees.id, id), isNull(employees.deletedAt)))
      .limit(1);
    if (!before) return { error: "Colaborador não encontrado." };

    await db
      .update(employees)
      .set(cpfUpdate ? { ...basePayload, ...cpfUpdate } : basePayload)
      .where(eq(employees.id, id));

    await writeAuditLog({
      user,
      action: "UPDATE",
      entityType: "employee",
      entityId: id,
      beforeData: {
        registration: before.registration,
        fullName: before.fullName,
      },
      afterData: {
        registration: basePayload.registration,
        fullName: basePayload.fullName,
      },
    });
    revalidatePath("/colaboradores");
    revalidatePath(`/colaboradores/${id}`);
    return { ok: true, id };
  }

  const [created] = await db
    .insert(employees)
    .values({
      ...basePayload,
      ...(cpfUpdate ?? { cpfEncrypted: null, cpfHash: null }),
      createdBy: user.id,
      sourceSystem: "MANUAL",
    })
    .returning({ id: employees.id });

  await writeAuditLog({
    user,
    action: "CREATE",
    entityType: "employee",
    entityId: created.id,
    afterData: {
      registration: basePayload.registration,
      fullName: basePayload.fullName,
    },
  });
  revalidatePath("/colaboradores");
  return { ok: true, id: created.id };
}

export async function softDeleteEmployeeAction(formData: FormData) {
  const user = await requirePermission("employees", "delete");
  const id = String(formData.get("id") || "");
  if (!id) return;
  try {
    await requireEmployeeInUserScope(user, { employeeId: id });
  } catch {
    return;
  }
  const db = getDb();
  await db
    .update(employees)
    .set({ deletedAt: new Date(), updatedBy: user.id })
    .where(eq(employees.id, id));
  await writeAuditLog({
    user,
    action: "SOFT_DELETE",
    entityType: "employee",
    entityId: id,
  });
  revalidatePath("/colaboradores");
}

export async function upsertRegionAction(formData: FormData) {
  const user = await requirePermission("admin", "manage");
  const code = String(formData.get("code") || "").trim().toUpperCase();
  const name = String(formData.get("name") || "").trim();
  if (!code || !name) throw new Error("Código e nome obrigatórios.");
  const db = getDb();
  await db.insert(regions).values({
    code,
    name,
    createdBy: user.id,
    updatedBy: user.id,
  });
  revalidatePath("/administracao");
}

export async function upsertUnitAction(formData: FormData) {
  const user = await requirePermission("admin", "manage");
  const regionId = String(formData.get("regionId") || "");
  const name = String(formData.get("name") || "").trim();
  const city = String(formData.get("city") || "").trim() || null;
  if (!regionId || !name) throw new Error("Regional e nome obrigatórios.");
  const db = getDb();
  await db.insert(units).values({
    regionId,
    name,
    city,
    createdBy: user.id,
    updatedBy: user.id,
  });
  revalidatePath("/administracao");
}
