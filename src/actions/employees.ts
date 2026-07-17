"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { employees, regions, units } from "@/db/schemas";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { requireEmployeeInUserScope } from "@/lib/scope";

export type ActionState = { error?: string; ok?: boolean; id?: string };

/**
 * Cadastro/edição cadastral manual desabilitados.
 * Fonte oficial: espelho Alterdata (somente sync/import).
 */
export async function upsertEmployeeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("id") || "");
  if (id) {
    return {
      error:
        "Os dados cadastrais deste colaborador são atualizados pelo Alterdata.",
    };
  }
  return {
    error: "Os colaboradores são cadastrados exclusivamente pelo Alterdata.",
  };
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
