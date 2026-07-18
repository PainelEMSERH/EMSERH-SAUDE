"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  appointments,
  asoRecords,
  biologicalAccidentFollowups,
  biologicalAccidents,
  employeeVaccinations,
  immunityTests,
  leaveExtensions,
  leaveRecords,
  physicians,
  pregnancyCases,
  pregnancyRelocations,
  pregnancyStatusHistory,
  returnToWorkRecords,
  vaccineRefusals,
  vaccines,
} from "@/db/schemas";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { addRealMonths, calcImc, calcLeaveDays, computeDeadlineStatus } from "@/lib/dates";
import { leaveRequiresReturnAso } from "@/lib/leaves/constants";
import {
  classifySituation,
  doseNumberFromSituation,
} from "@/lib/vaccination/constants";
import { requireEmployeeInUserScope } from "@/lib/scope";
import type { SessionUser } from "@/types";

export type ActionState = { error?: string; ok?: boolean };

async function resolveEmployee(user: SessionUser, registration: string) {
  const { id } = await requireEmployeeInUserScope(user, { registration });
  return id;
}

export async function createAsoAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("asos", "create");
    const schema = z.object({
      registration: z.string().min(1),
      asoType: z.string().min(1),
      performedDate: z.string().optional(),
      expectedDate: z.string().optional(),
      result: z.string().optional(),
      periodicityMonths: z.coerce.number().int().positive().optional(),
      adminNotes: z.string().optional(),
      planId: z.string().uuid().optional(),
    });
    const data = schema.parse({
      registration: formData.get("registration"),
      asoType: formData.get("asoType"),
      performedDate: formData.get("performedDate") || undefined,
      expectedDate: formData.get("expectedDate") || undefined,
      result: formData.get("result") || undefined,
      periodicityMonths: formData.get("periodicityMonths") || undefined,
      adminNotes: formData.get("adminNotes") || undefined,
      planId: formData.get("planId") || undefined,
    });

    const employeeId = await resolveEmployee(user, data.registration);
    const periodicity = data.periodicityMonths ?? 12;
    const performed = data.performedDate?.trim() || null;
    const expected = data.expectedDate?.trim() || null;

    // Separação planejamento × realização:
    // - só prevista: não avança last/next como se tivesse sido realizado
    // - realizada: lastAsoDate + próximo ciclo a partir da data realizada
    let lastAsoDate: string | null = null;
    let nextAsoDate: string | null = null;
    let deadlineStatus: string | null = null;

    if (performed) {
      const base = new Date(`${performed}T12:00:00`);
      if (Number.isNaN(base.getTime())) {
        return { error: "Data realizada inválida." };
      }
      lastAsoDate = performed;
      nextAsoDate = addRealMonths(base, periodicity).toISOString().slice(0, 10);
      deadlineStatus = computeDeadlineStatus(new Date(`${nextAsoDate}T12:00:00`));
    } else if (expected) {
      deadlineStatus = computeDeadlineStatus(new Date(`${expected}T12:00:00`));
    }

    const db = getDb();
    const [created] = await db
      .insert(asoRecords)
      .values({
        employeeId,
        asoType: data.asoType,
        performedDate: performed,
        expectedDate: expected,
        result: data.result || null,
        periodicityMonths: periodicity,
        lastAsoDate,
        nextAsoDate,
        deadlineStatus,
        adminNotes: data.adminNotes || null,
        planId: data.planId || null,
        origin: "MANUAL",
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning({ id: asoRecords.id });

    await writeAuditLog({
      user,
      action: "CREATE",
      entityType: "aso_record",
      entityId: created.id,
      metadata: {
        hasPerformedDate: Boolean(performed),
        hasExpectedDate: Boolean(expected),
      },
    });
    revalidatePath("/asos");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao salvar ASO." };
  }
}

export async function createAppointmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("agenda", "create");
    const schema = z.object({
      registration: z.string().min(1),
      appointmentType: z.string().min(1),
      scheduledAt: z.string().min(1),
      physicianName: z.string().optional(),
      presenceStatus: z.string().optional(),
      conduct: z.string().optional(),
      result: z.string().optional(),
      weightKg: z.coerce.number().optional(),
      heightCm: z.coerce.number().optional(),
    });
    const data = schema.parse({
      registration: formData.get("registration"),
      appointmentType: formData.get("appointmentType"),
      scheduledAt: formData.get("scheduledAt"),
      physicianName: formData.get("physicianName") || undefined,
      presenceStatus: formData.get("presenceStatus") || undefined,
      conduct: formData.get("conduct") || undefined,
      result: formData.get("result") || undefined,
      weightKg: formData.get("weightKg") || undefined,
      heightCm: formData.get("heightCm") || undefined,
    });

    const employeeId = await resolveEmployee(user, data.registration);
    const db = getDb();
    let physicianId: string | null = null;
    if (data.physicianName?.trim()) {
      const [existing] = await db
        .select()
        .from(physicians)
        .where(eq(physicians.name, data.physicianName.trim()))
        .limit(1);
      if (existing) physicianId = existing.id;
      else {
        const [created] = await db
          .insert(physicians)
          .values({ name: data.physicianName.trim() })
          .returning({ id: physicians.id });
        physicianId = created.id;
      }
    }

    const imc =
      data.weightKg && data.heightCm
        ? calcImc(data.weightKg, data.heightCm)
        : null;

    const [created] = await db
      .insert(appointments)
      .values({
        employeeId,
        physicianId,
        appointmentType: data.appointmentType,
        scheduledAt: new Date(data.scheduledAt),
        presenceStatus: data.presenceStatus || null,
        conduct: data.conduct || null,
        result: data.result || null,
        weightKg: data.weightKg ?? null,
        heightCm: data.heightCm ?? null,
        imc,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning({ id: appointments.id });

    await writeAuditLog({
      user,
      action: "CREATE",
      entityType: "appointment",
      entityId: created.id,
    });
    revalidatePath("/agenda");
    return { ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Falha ao salvar agenda.",
    };
  }
}

export async function createLeaveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("leaves", "create");
    const schema = z.object({
      registration: z.string().min(1),
      leaveType: z.string().min(1),
      startDate: z.string().min(1),
      endDate: z.string().optional(),
      cidCode: z.string().optional(),
      reason: z.string().optional(),
      reasonSimplified: z.string().optional(),
      status: z.string().default("ATIVO"),
    });
    const data = schema.parse({
      registration: formData.get("registration"),
      leaveType: formData.get("leaveType"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate") || undefined,
      cidCode: formData.get("cidCode") || undefined,
      reason: formData.get("reason") || undefined,
      reasonSimplified: formData.get("reasonSimplified") || undefined,
      status: formData.get("status") || "ATIVO",
    });

    const employeeId = await resolveEmployee(user, data.registration);
    const daysCount = data.endDate
      ? calcLeaveDays(new Date(data.startDate), new Date(data.endDate))
      : null;
    const cidNormalized = data.cidCode
      ? data.cidCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
      : null;

    const db = getDb();
    const [created] = await db
      .insert(leaveRecords)
      .values({
        employeeId,
        leaveType: data.leaveType,
        startDate: data.startDate,
        endDate: data.endDate || null,
        daysCount,
        cidCode: data.cidCode || null,
        cidNormalized,
        reason: data.reason || null,
        reasonSimplified: data.reasonSimplified || null,
        status: data.status,
        requiresReturnAso: leaveRequiresReturnAso(data.leaveType),
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning({ id: leaveRecords.id });

    await writeAuditLog({
      user,
      action: "CREATE",
      entityType: "leave_record",
      entityId: created.id,
    });
    revalidatePath("/afastamentos");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Falha ao salvar afastamento.",
    };
  }
}

export async function closeLeaveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("leaves", "update");
    const schema = z.object({
      leaveId: z.string().uuid(),
      actualReturnDate: z.string().optional(),
      endDate: z.string().optional(),
    });
    const data = schema.parse({
      leaveId: formData.get("leaveId"),
      actualReturnDate: formData.get("actualReturnDate") || undefined,
      endDate: formData.get("endDate") || undefined,
    });

    const db = getDb();
    const [existing] = await db
      .select({
        id: leaveRecords.id,
        employeeId: leaveRecords.employeeId,
        startDate: leaveRecords.startDate,
        status: leaveRecords.status,
        requiresReturnAso: leaveRecords.requiresReturnAso,
      })
      .from(leaveRecords)
      .where(eq(leaveRecords.id, data.leaveId))
      .limit(1);

    if (!existing) return { error: "Afastamento não encontrado." };
    await requireEmployeeInUserScope(user, { employeeId: existing.employeeId });

    const endDate =
      data.endDate ||
      data.actualReturnDate ||
      new Date().toISOString().slice(0, 10);
    const actualReturnDate = data.actualReturnDate || endDate;
    const daysCount = calcLeaveDays(
      new Date(String(existing.startDate).slice(0, 10)),
      new Date(endDate),
    );

    await db
      .update(leaveRecords)
      .set({
        status: "ENCERRADO",
        endDate,
        daysCount,
        actualReturnDate,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(leaveRecords.id, data.leaveId));

    await db.insert(returnToWorkRecords).values({
      employeeId: existing.employeeId,
      leaveRecordId: existing.id,
      returnDate: actualReturnDate,
      asoRequired: existing.requiresReturnAso,
      status: existing.requiresReturnAso ? "PENDENTE" : "CONCLUIDO",
      createdBy: user.id,
      updatedBy: user.id,
    });

    await writeAuditLog({
      user,
      action: "UPDATE",
      entityType: "leave_record",
      entityId: data.leaveId,
      metadata: {
        closed: true,
        asoRequired: existing.requiresReturnAso,
      },
    });
    revalidatePath("/afastamentos");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Falha ao encerrar afastamento.",
    };
  }
}

export async function extendLeaveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("leaves", "update");
    const schema = z.object({
      leaveId: z.string().uuid(),
      newEndDate: z.string().min(1),
      reason: z.string().optional(),
    });
    const data = schema.parse({
      leaveId: formData.get("leaveId"),
      newEndDate: formData.get("newEndDate"),
      reason: formData.get("reason") || undefined,
    });

    const db = getDb();
    const [existing] = await db
      .select({
        id: leaveRecords.id,
        employeeId: leaveRecords.employeeId,
        startDate: leaveRecords.startDate,
        endDate: leaveRecords.endDate,
        status: leaveRecords.status,
      })
      .from(leaveRecords)
      .where(eq(leaveRecords.id, data.leaveId))
      .limit(1);

    if (!existing) return { error: "Afastamento não encontrado." };
    if (existing.status === "ENCERRADO") {
      return { error: "Afastamento já encerrado." };
    }
    await requireEmployeeInUserScope(user, { employeeId: existing.employeeId });

    const previousEndDate =
      existing.endDate ||
      String(existing.startDate).slice(0, 10);

    if (data.newEndDate < previousEndDate) {
      return { error: "A nova data fim deve ser igual ou posterior à atual." };
    }

    const daysCount = calcLeaveDays(
      new Date(String(existing.startDate).slice(0, 10)),
      new Date(data.newEndDate),
    );

    await db.insert(leaveExtensions).values({
      leaveRecordId: existing.id,
      previousEndDate,
      newEndDate: data.newEndDate,
      reason: data.reason || null,
      createdBy: user.id,
      updatedBy: user.id,
    });

    await db
      .update(leaveRecords)
      .set({
        endDate: data.newEndDate,
        expectedReturnDate: data.newEndDate,
        daysCount,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(leaveRecords.id, existing.id));

    await writeAuditLog({
      user,
      action: "UPDATE",
      entityType: "leave_extension",
      entityId: existing.id,
      metadata: {
        previousEndDate,
        newEndDate: data.newEndDate,
      },
    });
    revalidatePath("/afastamentos");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Falha ao prorrogar afastamento.",
    };
  }
}

export async function createVaccinationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("vaccination", "create");
    const schema = z.object({
      registration: z.string().min(1),
      vaccineCode: z.string().min(1),
      situation: z.string().min(1),
      administeredAt: z.string().optional(),
      lotNumber: z.string().optional(),
      notes: z.string().optional(),
    });
    const data = schema.parse({
      registration: formData.get("registration"),
      vaccineCode: formData.get("vaccineCode"),
      situation: formData.get("situation"),
      administeredAt: formData.get("administeredAt") || undefined,
      lotNumber: formData.get("lotNumber") || undefined,
      notes: formData.get("notes") || undefined,
    });

    const employeeId = await resolveEmployee(user, data.registration);
    const db = getDb();
    let [vaccine] = await db
      .select()
      .from(vaccines)
      .where(eq(vaccines.code, data.vaccineCode))
      .limit(1);
    if (!vaccine) {
      const names: Record<string, string> = {
        TETANO: "Tétano",
        HEPATITE_B: "Hepatite B",
        TRIPLICE: "Tríplice viral",
        FEBRE_AMARELA: "Febre amarela",
        H1N1: "Influenza/H1N1",
        COVID: "COVID-19",
      };
      const [createdVac] = await db
        .insert(vaccines)
        .values({
          code: data.vaccineCode,
          name: names[data.vaccineCode] ?? data.vaccineCode,
        })
        .returning();
      vaccine = createdVac;
    }

    const doseNumber = doseNumberFromSituation(data.situation);
    const kind = classifySituation(data.vaccineCode, data.situation);
    const noteParts = [
      `${data.vaccineCode}: ${data.situation}`,
      data.notes?.trim() || null,
    ].filter(Boolean);
    const eventDate =
      data.administeredAt || new Date().toISOString().slice(0, 10);

    if (kind === "refusal") {
      const [created] = await db
        .insert(vaccineRefusals)
        .values({
          employeeId,
          vaccineId: vaccine.id,
          refusedAt: eventDate,
          reason: data.notes?.trim() || data.situation,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning({ id: vaccineRefusals.id });

      // Mantém espelho na vacinação para o kit/resumo continuar funcionando
      await db.insert(employeeVaccinations).values({
        employeeId,
        vaccineId: vaccine.id,
        doseNumber: 0,
        administeredAt: null,
        lotNumber: null,
        notes: noteParts.join(" | "),
        status: data.situation,
        createdBy: user.id,
        updatedBy: user.id,
      });

      await writeAuditLog({
        user,
        action: "CREATE",
        entityType: "vaccine_refusal",
        entityId: created.id,
        metadata: { vaccineCode: data.vaccineCode },
      });
      revalidatePath("/vacinacao");
      revalidatePath("/dashboard");
      return { ok: true };
    }

    const isAntiHbs = data.situation.toLowerCase().includes("ant hbs");
    if (isAntiHbs) {
      const result = data.situation.toLowerCase().includes("nao reagente")
        ? "NAO_REAGENTE"
        : "REAGENTE";
      const [created] = await db
        .insert(immunityTests)
        .values({
          employeeId,
          testType: "ANTI_HBS",
          testedAt: eventDate,
          result,
          interpretation: data.situation,
          notes: data.notes?.trim() || null,
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning({ id: immunityTests.id });

      await db.insert(employeeVaccinations).values({
        employeeId,
        vaccineId: vaccine.id,
        doseNumber: Math.max(doseNumber, 1),
        administeredAt: data.administeredAt || null,
        lotNumber: data.lotNumber || null,
        notes: noteParts.join(" | "),
        status: data.situation,
        createdBy: user.id,
        updatedBy: user.id,
      });

      await writeAuditLog({
        user,
        action: "CREATE",
        entityType: "immunity_test",
        entityId: created.id,
        metadata: { vaccineCode: data.vaccineCode, result },
      });
      revalidatePath("/vacinacao");
      revalidatePath("/dashboard");
      return { ok: true };
    }

    const [created] = await db
      .insert(employeeVaccinations)
      .values({
        employeeId,
        vaccineId: vaccine.id,
        doseNumber: Math.max(doseNumber, 1),
        administeredAt: data.administeredAt || null,
        lotNumber: data.lotNumber || null,
        notes: noteParts.join(" | "),
        status: data.situation,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning({ id: employeeVaccinations.id });

    await writeAuditLog({
      user,
      action: "CREATE",
      entityType: "employee_vaccination",
      entityId: created.id,
    });
    revalidatePath("/vacinacao");
    return { ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Falha ao salvar vacinação.",
    };
  }
}

export async function createPregnancyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("pregnancy", "create");
    const schema = z.object({
      registration: z.string().min(1),
      communicationDate: z.string().optional(),
      proofType: z.string().optional(),
      dueDate: z.string().optional(),
      hazardousActivity: z.enum(["true", "false"]).optional(),
      originSector: z.string().optional(),
      destinationSector: z.string().optional(),
      relocationDate: z.string().optional(),
      status: z.string().default("EM_ACOMPANHAMENTO"),
      notes: z.string().optional(),
    });
    const data = schema.parse({
      registration: formData.get("registration"),
      communicationDate: formData.get("communicationDate") || undefined,
      proofType: formData.get("proofType") || undefined,
      dueDate: formData.get("dueDate") || undefined,
      hazardousActivity: formData.get("hazardousActivity") || undefined,
      originSector: formData.get("originSector") || undefined,
      destinationSector: formData.get("destinationSector") || undefined,
      relocationDate: formData.get("relocationDate") || undefined,
      status: formData.get("status") || "EM_ACOMPANHAMENTO",
      notes: formData.get("notes") || undefined,
    });

    const employeeId = await resolveEmployee(user, data.registration);
    const hazardous = data.hazardousActivity === "true";
    const db = getDb();
    const [created] = await db
      .insert(pregnancyCases)
      .values({
        employeeId,
        communicationDate: data.communicationDate || null,
        proofType: data.proofType || null,
        dueDate: data.dueDate || null,
        hazardousActivity: hazardous,
        relocationNeeded: hazardous,
        originSector: data.originSector || null,
        destinationSector: data.destinationSector || null,
        relocationDate: data.relocationDate || null,
        status: data.status,
        notes: data.notes || null,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning({ id: pregnancyCases.id });

    await db.insert(pregnancyStatusHistory).values({
      pregnancyCaseId: created.id,
      status: data.status,
      notes: data.notes || null,
      createdBy: user.id,
      updatedBy: user.id,
    });

    if (data.destinationSector?.trim() && data.relocationDate) {
      await db.insert(pregnancyRelocations).values({
        pregnancyCaseId: created.id,
        fromSector: data.originSector || null,
        toSector: data.destinationSector.trim(),
        relocatedAt: data.relocationDate,
        notes: data.notes || null,
        createdBy: user.id,
        updatedBy: user.id,
      });
    }

    await writeAuditLog({
      user,
      action: "CREATE",
      entityType: "pregnancy_case",
      entityId: created.id,
    });
    revalidatePath("/gestantes");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Falha ao salvar gestante.",
    };
  }
}

export async function updatePregnancyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("pregnancy", "update");
    const schema = z.object({
      pregnancyId: z.string().uuid(),
      status: z.enum(["EM_ACOMPANHAMENTO", "LICENCA", "APTO"]),
      destinationSector: z.string().optional(),
      relocationDate: z.string().optional(),
      leaveStartDate: z.string().optional(),
      returnDate: z.string().optional(),
      notes: z.string().optional(),
    });
    const data = schema.parse({
      pregnancyId: formData.get("pregnancyId"),
      status: formData.get("status"),
      destinationSector: formData.get("destinationSector") || undefined,
      relocationDate: formData.get("relocationDate") || undefined,
      leaveStartDate: formData.get("leaveStartDate") || undefined,
      returnDate: formData.get("returnDate") || undefined,
      notes: formData.get("notes") || undefined,
    });

    const db = getDb();
    const [existing] = await db
      .select({
        id: pregnancyCases.id,
        employeeId: pregnancyCases.employeeId,
        hazardousActivity: pregnancyCases.hazardousActivity,
        status: pregnancyCases.status,
        originSector: pregnancyCases.originSector,
        destinationSector: pregnancyCases.destinationSector,
        relocationDate: pregnancyCases.relocationDate,
      })
      .from(pregnancyCases)
      .where(eq(pregnancyCases.id, data.pregnancyId))
      .limit(1);

    if (!existing) return { error: "Caso não encontrado." };
    await requireEmployeeInUserScope(user, { employeeId: existing.employeeId });

    const nextDestination =
      data.destinationSector?.trim() || existing.destinationSector || null;
    const nextRelocationDate =
      data.relocationDate || existing.relocationDate || null;

    if (existing.status !== data.status) {
      await db.insert(pregnancyStatusHistory).values({
        pregnancyCaseId: existing.id,
        status: data.status,
        notes: data.notes || null,
        createdBy: user.id,
        updatedBy: user.id,
      });
    }

    const relocationChanged =
      Boolean(data.destinationSector?.trim()) &&
      (data.destinationSector?.trim() !== (existing.destinationSector ?? "") ||
        (data.relocationDate &&
          data.relocationDate !== existing.relocationDate));

    if (relocationChanged && nextDestination) {
      await db.insert(pregnancyRelocations).values({
        pregnancyCaseId: existing.id,
        fromSector:
          existing.destinationSector || existing.originSector || null,
        toSector: nextDestination,
        relocatedAt:
          nextRelocationDate || new Date().toISOString().slice(0, 10),
        notes: data.notes || null,
        createdBy: user.id,
        updatedBy: user.id,
      });
    }

    await db
      .update(pregnancyCases)
      .set({
        status: data.status,
        destinationSector: nextDestination,
        relocationDate: nextRelocationDate,
        relocationNeeded: Boolean(
          existing.hazardousActivity || nextRelocationDate,
        ),
        leaveStartDate: data.leaveStartDate || null,
        maternityLeave: data.status === "LICENCA",
        returnDate: data.returnDate || null,
        notes: data.notes || null,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(pregnancyCases.id, data.pregnancyId));

    await writeAuditLog({
      user,
      action: "UPDATE",
      entityType: "pregnancy_case",
      entityId: data.pregnancyId,
      metadata: { status: data.status },
    });
    revalidatePath("/gestantes");
    revalidatePath("/dashboard");
    revalidatePath(`/colaboradores/${existing.employeeId}`);
    return { ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Falha ao atualizar gestante.",
    };
  }
}

export async function createBiologicalAccidentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("biological", "create");
    const schema = z.object({
      registration: z.string().min(1),
      occurredAt: z.string().min(1),
      exposureType: z.string().optional(),
      bodyPart: z.string().optional(),
      description: z.string().optional(),
      pepStarted: z.enum(["true", "false"]).optional(),
      catNumber: z.string().optional(),
    });
    const data = schema.parse({
      registration: formData.get("registration"),
      occurredAt: formData.get("occurredAt"),
      exposureType: formData.get("exposureType") || undefined,
      bodyPart: formData.get("bodyPart") || undefined,
      description: formData.get("description") || undefined,
      pepStarted: formData.get("pepStarted") || undefined,
      catNumber: formData.get("catNumber") || undefined,
    });

    const employeeId = await resolveEmployee(user, data.registration);
    const occurredAt = new Date(data.occurredAt);
    const db = getDb();
    const [created] = await db
      .insert(biologicalAccidents)
      .values({
        employeeId,
        occurredAt,
        exposureType: data.exposureType || null,
        bodyPart: data.bodyPart || null,
        description: data.description || null,
        pepStarted: data.pepStarted === "true",
        pepStartDate:
          data.pepStarted === "true"
            ? occurredAt.toISOString().slice(0, 10)
            : null,
        catNumber: data.catNumber || null,
        status: "EM_ACOMPANHAMENTO",
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning({ id: biologicalAccidents.id });

    try {
      const followupRows = [30, 60, 90].map((dayOffset) => {
        const due = new Date(occurredAt);
        due.setDate(due.getDate() + dayOffset);
        return {
          accidentId: created.id,
          dayOffset,
          dueDate: due.toISOString().slice(0, 10),
          status: "PENDENTE" as const,
          createdBy: user.id,
          updatedBy: user.id,
        };
      });
      // Um único INSERT evita órfãos parciais (30/60/90)
      await db.insert(biologicalAccidentFollowups).values(followupRows);
    } catch (followupError) {
      await db
        .delete(biologicalAccidents)
        .where(eq(biologicalAccidents.id, created.id));
      throw followupError;
    }

    await writeAuditLog({
      user,
      action: "CREATE",
      entityType: "biological_accident",
      entityId: created.id,
      metadata: { followups: [30, 60, 90] },
    });
    revalidatePath("/material-biologico");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Falha ao salvar acidente.",
    };
  }
}

export async function completeBiologicalFollowupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("biological", "update");
    const schema = z.object({
      followupId: z.string().uuid(),
      performedAt: z.string().optional(),
      notes: z.string().optional(),
    });
    const data = schema.parse({
      followupId: formData.get("followupId"),
      performedAt: formData.get("performedAt") || undefined,
      notes: formData.get("notes") || undefined,
    });

    const db = getDb();
    const [existing] = await db
      .select({
        id: biologicalAccidentFollowups.id,
        accidentId: biologicalAccidentFollowups.accidentId,
        status: biologicalAccidentFollowups.status,
      })
      .from(biologicalAccidentFollowups)
      .where(eq(biologicalAccidentFollowups.id, data.followupId))
      .limit(1);

    if (!existing) return { error: "Follow-up não encontrado." };

    const [accident] = await db
      .select({
        id: biologicalAccidents.id,
        employeeId: biologicalAccidents.employeeId,
      })
      .from(biologicalAccidents)
      .where(eq(biologicalAccidents.id, existing.accidentId))
      .limit(1);

    if (!accident) return { error: "Acidente não encontrado." };
    await requireEmployeeInUserScope(user, { employeeId: accident.employeeId });

    const performedAt =
      data.performedAt || new Date().toISOString().slice(0, 10);

    await db
      .update(biologicalAccidentFollowups)
      .set({
        status: "REALIZADO",
        performedAt,
        notes: data.notes || null,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(biologicalAccidentFollowups.id, data.followupId));

    await writeAuditLog({
      user,
      action: "UPDATE",
      entityType: "biological_accident_followup",
      entityId: data.followupId,
      metadata: { performedAt, accidentId: existing.accidentId },
    });
    revalidatePath("/material-biologico");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return {
      error:
        e instanceof Error ? e.message : "Falha ao registrar follow-up.",
    };
  }
}

export async function concludeBiologicalAccidentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("biological", "update");
    const schema = z.object({
      accidentId: z.string().uuid(),
      conclusion: z.string().optional(),
    });
    const data = schema.parse({
      accidentId: formData.get("accidentId"),
      conclusion: formData.get("conclusion") || undefined,
    });

    const db = getDb();
    const [existing] = await db
      .select({
        id: biologicalAccidents.id,
        employeeId: biologicalAccidents.employeeId,
        status: biologicalAccidents.status,
      })
      .from(biologicalAccidents)
      .where(eq(biologicalAccidents.id, data.accidentId))
      .limit(1);

    if (!existing) return { error: "Acidente não encontrado." };
    await requireEmployeeInUserScope(user, { employeeId: existing.employeeId });

    await db
      .update(biologicalAccidents)
      .set({
        status: "CONCLUIDO",
        conclusion: data.conclusion || null,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(biologicalAccidents.id, data.accidentId));

    await writeAuditLog({
      user,
      action: "UPDATE",
      entityType: "biological_accident",
      entityId: data.accidentId,
      metadata: { concluded: true },
    });
    revalidatePath("/material-biologico");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Falha ao concluir acidente.",
    };
  }
}
