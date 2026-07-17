"use server";

import { and, desc, eq, isNull, like, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  asoCompetenceClosures,
  asoMonthlyPlans,
  asoRecords,
  asoSchedules,
  asoTargetHistory,
  asoTargets,
  importBatches,
} from "@/db/schemas";
import {
  generateAsoPlanningForYear,
  refreshPlanAlterdataStatuses,
} from "@/db/queries/aso-panel";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import {
  JUSTIFY_REASONS,
  reasonExcludesDenominator,
  resolveJustificationEligibility,
} from "@/lib/aso/execution";
import { migrateExistingAsoRecordsToPlans } from "@/lib/aso/migrate-existing";
import { yearMonthFromDate } from "@/lib/aso/planning";
import { addRealMonths, computeDeadlineStatus } from "@/lib/dates";
import { requireEmployeeInUserScope } from "@/lib/scope";
import { syncAlterdataAsoSnapshots } from "@/lib/sheets/mirror-sync";

export type AsoActionState = { error?: string; ok?: boolean; message?: string };

export async function generatePlanningAction(
  _prev: AsoActionState,
  formData: FormData,
): Promise<AsoActionState> {
  try {
    const user = await requirePermission("asos", "update");
    const year = Number(formData.get("year")) || new Date().getFullYear();
    const migration = await migrateExistingAsoRecordsToPlans(user.id);
    const result = await generateAsoPlanningForYear(user, year);
    await writeAuditLog({
      user,
      action: "GENERATE_ASO_PLANNING",
      entityType: "aso_monthly_plans",
      metadata: { ...result, migration },
    });
    revalidatePath("/asos");
    return {
      ok: true,
      message: `Planejamento ${year}: ${result.upserted} itens · ${result.skipped} ignorados (fechados/congelados) · ${result.cleaned ?? 0} previsões inconsistentes removidas. Migração de registros existentes: ${migration.linked} vinculados.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao gerar planejamento." };
  }
}

export async function syncAlterdataAsoAction(): Promise<AsoActionState> {
  try {
    const user = await requirePermission("asos", "update");
    const sync = await syncAlterdataAsoSnapshots({ user });
    if (!sync.ok) {
      return { error: sync.error || "Falha na sincronização." };
    }
    const refreshed = await refreshPlanAlterdataStatuses();
    await writeAuditLog({
      user,
      action: "SYNC_MIRROR",
      entityType: "aso_alterdata_snapshots",
      entityId: sync.batchId,
      metadata: {
        mode: "ASO_SNAPSHOTS_ONLY",
        snapshotsInserted: sync.snapshotsInserted,
        skipped: sync.skipped,
        unmatched: sync.unmatched,
        plansRefreshed: refreshed.updated,
        source: "aso_panel",
      },
    });
    revalidatePath("/asos");
    return {
      ok: true,
      message: `Sincronização ASO concluída: ${sync.snapshotsInserted} snapshots novos/atualizados · ${sync.skipped} sem alteração · ${sync.unmatched} matrículas sem cadastro · ${refreshed.updated} planos reconciliados.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao sincronizar." };
  }
}

/** Cancela lote de espelho preso em RUNNING (possível interrupção). */
export async function cancelStaleMirrorSyncAction(): Promise<AsoActionState> {
  try {
    const user = await requirePermission("asos", "update");
    const db = getDb();
    const [running] = await db
      .select({
        id: importBatches.id,
        createdAt: importBatches.createdAt,
        status: importBatches.status,
      })
      .from(importBatches)
      .where(
        and(
          eq(importBatches.status, "RUNNING"),
          or(
            like(importBatches.sourceName, "mirror:%"),
            like(importBatches.sourceName, "mirror-aso:%"),
            like(importBatches.sourceName, "mirror-fast:%"),
          ),
        ),
      )
      .orderBy(desc(importBatches.createdAt))
      .limit(1);

    if (!running) {
      return { error: "Não há sincronização em andamento." };
    }

    await db
      .update(importBatches)
      .set({
        status: "CANCELLED",
        updatedBy: user.id,
      })
      .where(eq(importBatches.id, running.id));

    await writeAuditLog({
      user,
      action: "CANCEL_MIRROR_SYNC",
      entityType: "import_batch",
      entityId: running.id,
      metadata: { previousStatus: "RUNNING" },
    });
    revalidatePath("/asos");
    return { ok: true, message: "Lote de sincronização cancelado." };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Falha ao cancelar sincronização.",
    };
  }
}

export async function registerAsoRealizationAction(
  _prev: AsoActionState,
  formData: FormData,
): Promise<AsoActionState> {
  try {
    const user = await requirePermission("asos", "create");
    const schema = z.object({
      planId: z.string().uuid(),
      performedDate: z.string().min(1),
      result: z.string().optional(),
      periodicityMonths: z.coerce.number().int().positive().optional(),
      adminNotes: z.string().optional(),
      correctionReason: z.string().optional(),
    });
    const data = schema.parse({
      planId: formData.get("planId"),
      performedDate: formData.get("performedDate"),
      result: formData.get("result") || undefined,
      periodicityMonths: formData.get("periodicityMonths") || undefined,
      adminNotes: formData.get("adminNotes") || undefined,
      correctionReason: formData.get("correctionReason") || undefined,
    });

    const db = getDb();
    const [plan] = await db
      .select()
      .from(asoMonthlyPlans)
      .where(
        and(eq(asoMonthlyPlans.id, data.planId), isNull(asoMonthlyPlans.deletedAt)),
      )
      .limit(1);
    if (!plan) return { error: "Item de planejamento não encontrado." };
    if (plan.frozen) {
      return { error: "Competência fechada: não é possível alterar este item." };
    }

    await requireEmployeeInUserScope(user, { employeeId: plan.employeeId });

    const alreadyRealized =
      plan.executionStatus === "REALIZADO" || Boolean(plan.asoRecordId);
    if (alreadyRealized) {
      if (!data.correctionReason?.trim()) {
        return {
          error:
            "Este item já possui realização. Informe o motivo da correção para alterar.",
        };
      }
      await requirePermission("asos", "update");
    }

    const periodicity = data.periodicityMonths ?? 12;
    const base = new Date(`${data.performedDate}T12:00:00`);
    if (Number.isNaN(base.getTime())) return { error: "Data realizada inválida." };
    const nextAsoDate = addRealMonths(base, periodicity)
      .toISOString()
      .slice(0, 10);
    const deadlineStatus = computeDeadlineStatus(
      new Date(`${nextAsoDate}T12:00:00`),
    );

    let recordId = plan.asoRecordId;
    if (recordId) {
      await db
        .update(asoRecords)
        .set({
          performedDate: data.performedDate,
          lastAsoDate: data.performedDate,
          nextAsoDate,
          deadlineStatus,
          result: data.result || null,
          periodicityMonths: periodicity,
          adminNotes: data.adminNotes || null,
          planId: plan.id,
          regionId: plan.regionId,
          unitId: plan.unitId,
          origin: "MANUAL",
          updatedBy: user.id,
        })
        .where(eq(asoRecords.id, recordId));
    } else {
      const [created] = await db
        .insert(asoRecords)
        .values({
          employeeId: plan.employeeId,
          asoType: plan.asoType,
          expectedDate: plan.expectedDate,
          performedDate: data.performedDate,
          lastAsoDate: data.performedDate,
          nextAsoDate,
          deadlineStatus,
          result: data.result || null,
          periodicityMonths: periodicity,
          adminNotes: data.adminNotes || null,
          planId: plan.id,
          regionId: plan.regionId,
          unitId: plan.unitId,
          origin: "MANUAL",
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning({ id: asoRecords.id });
      recordId = created.id;
    }

    await db
      .update(asoMonthlyPlans)
      .set({
        asoRecordId: recordId,
        executionStatus: "REALIZADO",
        alterdataStatus: "AGUARDANDO_SINCRONIZACAO",
        eligibility: "ELEGIVEL",
        updatedBy: user.id,
      })
      .where(eq(asoMonthlyPlans.id, plan.id));

    await writeAuditLog({
      user,
      action: alreadyRealized
        ? "CORRECT_ASO_REALIZATION"
        : "REGISTER_ASO_REALIZATION",
      entityType: "aso_record",
      entityId: recordId!,
      metadata: {
        planId: plan.id,
        performedDate: data.performedDate,
        correctionReason: data.correctionReason || null,
        previousRecordId: plan.asoRecordId,
      },
    });
    revalidatePath("/asos");
    return { ok: true, message: "Realização salva com sucesso." };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Falha ao registrar realização.",
    };
  }
}

export async function justifyAsoPlanAction(
  _prev: AsoActionState,
  formData: FormData,
): Promise<AsoActionState> {
  try {
    const user = await requirePermission("asos", "update");
    const planId = String(formData.get("planId") || "");
    const reason = String(formData.get("reason") || "").trim().toUpperCase();
    const notes = String(formData.get("notes") || "").trim();
    const excludeRaw = String(formData.get("excludeDenominator") || "");
    if (!planId || !reason) return { error: "Informe o motivo da justificativa." };
    if (!notes) return { error: "Informe a observação da justificativa." };

    const allowed = JUSTIFY_REASONS.some((r) => r.value === reason);
    if (!allowed) return { error: "Motivo de justificativa inválido." };

    const db = getDb();
    const [plan] = await db
      .select()
      .from(asoMonthlyPlans)
      .where(and(eq(asoMonthlyPlans.id, planId), isNull(asoMonthlyPlans.deletedAt)))
      .limit(1);
    if (!plan) return { error: "Item não encontrado." };
    if (plan.frozen) return { error: "Competência fechada." };
    if (plan.executionStatus === "REALIZADO" || plan.asoRecordId) {
      return { error: "Não é possível justificar um item já realizado." };
    }
    await requireEmployeeInUserScope(user, { employeeId: plan.employeeId });

    const resolved = resolveJustificationEligibility(reason);
    // Servidor valida: recusa/falta nunca excluem. Usuário pode manter no denominador.
    const finalEligibility =
      reasonExcludesDenominator(reason) && excludeRaw === "0"
        ? "ELEGIVEL"
        : resolved.eligibility;
    const executionStatus = resolved.executionStatus;

    await db
      .update(asoMonthlyPlans)
      .set({
        eligibility: finalEligibility,
        executionStatus,
        justificationReason: reason,
        justificationNotes: notes,
        justifiedAt: new Date(),
        justifiedBy: user.id,
        updatedBy: user.id,
      })
      .where(eq(asoMonthlyPlans.id, planId));

    await writeAuditLog({
      user,
      action: "JUSTIFY_ASO_PLAN",
      entityType: "aso_monthly_plan",
      entityId: planId,
      metadata: {
        reason,
        notes,
        previous: {
          eligibility: plan.eligibility,
          executionStatus: plan.executionStatus,
        },
        next: { eligibility: finalEligibility, executionStatus },
        excludesDenominator: reasonExcludesDenominator(reason),
      },
    });
    revalidatePath("/asos");
    return { ok: true, message: "Justificativa registrada." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao justificar." };
  }
}

export async function reprogramAsoPlanAction(
  _prev: AsoActionState,
  formData: FormData,
): Promise<AsoActionState> {
  try {
    const user = await requirePermission("asos", "update");
    const planId = String(formData.get("planId") || "");
    const newDate = String(formData.get("newDate") || "").trim();
    const reason = String(formData.get("reason") || "").trim();
    const notes = String(formData.get("notes") || "").trim();
    if (!planId || !newDate) return { error: "Informe a nova data." };
    if (!reason) return { error: "Informe o motivo da reprogramação." };

    const ym = yearMonthFromDate(newDate);
    if (!ym) return { error: "Data inválida." };

    const db = getDb();
    const [plan] = await db
      .select()
      .from(asoMonthlyPlans)
      .where(and(eq(asoMonthlyPlans.id, planId), isNull(asoMonthlyPlans.deletedAt)))
      .limit(1);
    if (!plan) return { error: "Item não encontrado." };
    if (plan.frozen) return { error: "Competência fechada." };
    if (plan.executionStatus === "REALIZADO" || plan.asoRecordId) {
      return { error: "Não é possível reprogramar um item já realizado." };
    }
    await requireEmployeeInUserScope(user, { employeeId: plan.employeeId });

    const originalExpected = plan.expectedDate;

    await db
      .update(asoMonthlyPlans)
      .set({
        executionStatus: "REPROGRAMADO",
        reprogrammedToDate: newDate,
        reprogrammedReason: `${reason}${notes ? ` — ${notes}` : ""}`,
        // Mantém expectedDate/competência originais para aderência histórica
        updatedBy: user.id,
      })
      .where(eq(asoMonthlyPlans.id, planId));

    // Cria/atualiza item na nova competência (aberta) — sem apagar o original
    const [existing] = await db
      .select()
      .from(asoMonthlyPlans)
      .where(
        and(
          eq(asoMonthlyPlans.employeeId, plan.employeeId),
          eq(asoMonthlyPlans.asoType, plan.asoType),
          eq(asoMonthlyPlans.year, ym.year),
          eq(asoMonthlyPlans.month, ym.month),
          isNull(asoMonthlyPlans.deletedAt),
        ),
      )
      .limit(1);

    if (existing && existing.id !== plan.id && !existing.frozen) {
      await db
        .update(asoMonthlyPlans)
        .set({
          expectedDate: newDate,
          predictionOrigin: "ALTERDATA_NEXT_ASO",
          executionStatus: "PREVISTO",
          updatedBy: user.id,
        })
        .where(eq(asoMonthlyPlans.id, existing.id));
    } else if (!existing) {
      await db.insert(asoMonthlyPlans).values({
        employeeId: plan.employeeId,
        registration: plan.registration,
        employeeName: plan.employeeName,
        asoType: plan.asoType,
        year: ym.year,
        month: ym.month,
        expectedDate: newDate,
        regionId: plan.regionId,
        unitId: plan.unitId,
        regionNameSnapshot: plan.regionNameSnapshot,
        unitNameSnapshot: plan.unitNameSnapshot,
        functionalStatusSnapshot: plan.functionalStatusSnapshot,
        predictionOrigin: "ALTERDATA_NEXT_ASO",
        eligibility: "ELEGIVEL",
        executionStatus: "PREVISTO",
        alterdataStatus: "NAO_APLICAVEL",
        createdBy: user.id,
        updatedBy: user.id,
      });
    }

    await writeAuditLog({
      user,
      action: "REPROGRAM_ASO_PLAN",
      entityType: "aso_monthly_plan",
      entityId: planId,
      metadata: {
        newDate,
        reason,
        notes,
        originalExpected,
        originalCompetence: `${plan.year}-${String(plan.month).padStart(2, "0")}`,
        targetCompetence: `${ym.year}-${String(ym.month).padStart(2, "0")}`,
      },
    });
    revalidatePath("/asos");
    return { ok: true, message: "Reprogramação registrada. Competência original preservada." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao reprogramar." };
  }
}

export async function scheduleAsoPlanAction(
  _prev: AsoActionState,
  formData: FormData,
): Promise<AsoActionState> {
  try {
    const user = await requirePermission("asos", "update");
    const planId = String(formData.get("planId") || "");
    const scheduledAt = String(formData.get("scheduledAt") || "").trim();
    if (!planId || !scheduledAt) return { error: "Informe data/hora do agendamento." };

    const db = getDb();
    const [plan] = await db
      .select()
      .from(asoMonthlyPlans)
      .where(and(eq(asoMonthlyPlans.id, planId), isNull(asoMonthlyPlans.deletedAt)))
      .limit(1);
    if (!plan) return { error: "Item não encontrado." };
    if (plan.frozen) return { error: "Competência fechada." };
    await requireEmployeeInUserScope(user, { employeeId: plan.employeeId });

    await db.insert(asoSchedules).values({
      employeeId: plan.employeeId,
      asoRecordId: plan.asoRecordId,
      scheduledAt: new Date(scheduledAt),
      status: "AGENDADO",
      createdBy: user.id,
      updatedBy: user.id,
    });
    await db
      .update(asoMonthlyPlans)
      .set({ executionStatus: "AGENDADO", updatedBy: user.id })
      .where(eq(asoMonthlyPlans.id, planId));

    await writeAuditLog({
      user,
      action: "SCHEDULE_ASO",
      entityType: "aso_monthly_plan",
      entityId: planId,
    });
    revalidatePath("/asos");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao agendar." };
  }
}

export async function upsertAsoTargetAction(formData: FormData): Promise<void> {
  const user = await requirePermission("asos", "update");
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const asoType = String(formData.get("asoType") || "ALL");
  const scopeType = String(formData.get("scopeType") || "EMSERH");
  const regionId = String(formData.get("regionId") || "") || null;
  const unitId = String(formData.get("unitId") || "") || null;
  const targetPercent = Number(formData.get("targetPercent"));
  const reason = String(formData.get("reason") || "").trim();
  if (!year || !month || Number.isNaN(targetPercent)) {
    throw new Error("Ano, competência e meta são obrigatórios.");
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(asoTargets)
    .where(
      and(
        isNull(asoTargets.deletedAt),
        eq(asoTargets.year, year),
        eq(asoTargets.month, month),
        eq(asoTargets.asoType, asoType),
        eq(asoTargets.scopeType, scopeType),
        regionId ? eq(asoTargets.regionId, regionId) : isNull(asoTargets.regionId),
        unitId ? eq(asoTargets.unitId, unitId) : isNull(asoTargets.unitId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(asoTargets)
      .set({
        targetPercent,
        updatedBy: user.id,
      })
      .where(eq(asoTargets.id, existing.id));
    await db.insert(asoTargetHistory).values({
      targetId: existing.id,
      previousPercent: existing.targetPercent,
      newPercent: targetPercent,
      reason: reason || null,
      createdBy: user.id,
      updatedBy: user.id,
    });
  } else {
    const [created] = await db
      .insert(asoTargets)
      .values({
        year,
        month,
        asoType,
        scopeType,
        regionId,
        unitId,
        targetPercent,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning({ id: asoTargets.id });
    await db.insert(asoTargetHistory).values({
      targetId: created.id,
      previousPercent: null,
      newPercent: targetPercent,
      reason: reason || "Meta inicial",
      createdBy: user.id,
      updatedBy: user.id,
    });
  }

  await writeAuditLog({
    user,
    action: "UPSERT_ASO_TARGET",
    entityType: "aso_target",
    metadata: { year, month, asoType, scopeType, targetPercent, reason },
  });
  revalidatePath("/asos");
}

export async function setCompetenceStatusAction(formData: FormData): Promise<void> {
  const user = await requirePermission("asos", "update");
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const status = String(formData.get("status") || "");
  const asoType = String(formData.get("asoType") || "ALL");
  const scopeType = String(formData.get("scopeType") || "EMSERH");
  const regionId = String(formData.get("regionId") || "") || null;
  const unitId = String(formData.get("unitId") || "") || null;
  const reopenReason = String(formData.get("reopenReason") || "").trim();

  if (!["ABERTA", "EM_CONFERENCIA", "FECHADA"].includes(status)) {
    throw new Error("Status inválido.");
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(asoCompetenceClosures)
    .where(
      and(
        eq(asoCompetenceClosures.year, year),
        eq(asoCompetenceClosures.month, month),
        eq(asoCompetenceClosures.asoType, asoType),
        eq(asoCompetenceClosures.scopeType, scopeType),
        regionId
          ? eq(asoCompetenceClosures.regionId, regionId)
          : isNull(asoCompetenceClosures.regionId),
        unitId
          ? eq(asoCompetenceClosures.unitId, unitId)
          : isNull(asoCompetenceClosures.unitId),
      ),
    )
    .limit(1);

  if (existing?.status === "FECHADA" && status !== "FECHADA" && !reopenReason) {
    throw new Error("Informe o motivo para reabrir a competência.");
  }

  if (existing) {
    await db
      .update(asoCompetenceClosures)
      .set({
        status,
        closedAt: status === "FECHADA" ? new Date() : existing.closedAt,
        closedBy: status === "FECHADA" ? user.id : existing.closedBy,
        reopenReason:
          existing.status === "FECHADA" && status !== "FECHADA"
            ? reopenReason
            : existing.reopenReason,
        reopenedAt:
          existing.status === "FECHADA" && status !== "FECHADA"
            ? new Date()
            : existing.reopenedAt,
        reopenedBy:
          existing.status === "FECHADA" && status !== "FECHADA"
            ? user.id
            : existing.reopenedBy,
        updatedBy: user.id,
      })
      .where(eq(asoCompetenceClosures.id, existing.id));
  } else {
    await db.insert(asoCompetenceClosures).values({
      year,
      month,
      asoType,
      scopeType,
      regionId,
      unitId,
      status,
      closedAt: status === "FECHADA" ? new Date() : null,
      closedBy: status === "FECHADA" ? user.id : null,
      createdBy: user.id,
      updatedBy: user.id,
    });
  }

  const freeze = status === "FECHADA";
  await db
    .update(asoMonthlyPlans)
    .set({ frozen: freeze, updatedBy: user.id })
    .where(
      and(
        eq(asoMonthlyPlans.year, year),
        eq(asoMonthlyPlans.month, month),
        asoType !== "ALL" ? eq(asoMonthlyPlans.asoType, asoType) : undefined,
        regionId ? eq(asoMonthlyPlans.regionId, regionId) : undefined,
        unitId ? eq(asoMonthlyPlans.unitId, unitId) : undefined,
        isNull(asoMonthlyPlans.deletedAt),
      ),
    );

  await writeAuditLog({
    user,
    action: "SET_ASO_COMPETENCE_STATUS",
    entityType: "aso_competence_closure",
    metadata: { year, month, status, reopenReason },
  });
  revalidatePath("/asos");
}

export async function getPlanSnapshotHistory(employeeId: string) {
  const user = await requirePermission("asos", "view");
  await requireEmployeeInUserScope(user, { employeeId });
  const { asoAlterdataSnapshots } = await import("@/db/schemas");
  const db = getDb();
  return db
    .select()
    .from(asoAlterdataSnapshots)
    .where(eq(asoAlterdataSnapshots.employeeId, employeeId))
    .orderBy(desc(asoAlterdataSnapshots.syncedAt))
    .limit(30);
}
