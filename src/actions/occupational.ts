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
  leaveRecords,
  physicians,
  pregnancyCases,
  vaccines,
} from "@/db/schemas";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { addRealMonths, calcImc, calcLeaveDays, computeDeadlineStatus } from "@/lib/dates";
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
    });
    const data = schema.parse({
      registration: formData.get("registration"),
      asoType: formData.get("asoType"),
      performedDate: formData.get("performedDate") || undefined,
      expectedDate: formData.get("expectedDate") || undefined,
      result: formData.get("result") || undefined,
      periodicityMonths: formData.get("periodicityMonths") || undefined,
      adminNotes: formData.get("adminNotes") || undefined,
    });

    const employeeId = await resolveEmployee(user, data.registration);
    const periodicity = data.periodicityMonths ?? 12;
    const baseDate = data.performedDate
      ? new Date(data.performedDate)
      : data.expectedDate
        ? new Date(data.expectedDate)
        : new Date();
    const nextAsoDate = addRealMonths(baseDate, periodicity);
    const deadlineStatus = computeDeadlineStatus(nextAsoDate);

    const db = getDb();
    const [created] = await db
      .insert(asoRecords)
      .values({
        employeeId,
        asoType: data.asoType,
        performedDate: data.performedDate || null,
        expectedDate: data.expectedDate || null,
        result: data.result || null,
        periodicityMonths: periodicity,
        lastAsoDate: data.performedDate || null,
        nextAsoDate: nextAsoDate.toISOString().slice(0, 10),
        deadlineStatus,
        adminNotes: data.adminNotes || null,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning({ id: asoRecords.id });

    await writeAuditLog({
      user,
      action: "CREATE",
      entityType: "aso_record",
      entityId: created.id,
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
        requiresReturnAso: ["INSS", "ACIDENTE", "AFASTAMENTO"].some((t) =>
          data.leaveType.toUpperCase().includes(t),
        ),
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

export async function createVaccinationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("vaccination", "create");
    const schema = z.object({
      registration: z.string().min(1),
      vaccineCode: z.string().min(1),
      doseNumber: z.coerce.number().int().positive(),
      administeredAt: z.string().optional(),
      lotNumber: z.string().optional(),
      notes: z.string().optional(),
    });
    const data = schema.parse({
      registration: formData.get("registration"),
      vaccineCode: formData.get("vaccineCode"),
      doseNumber: formData.get("doseNumber"),
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

    const [created] = await db
      .insert(employeeVaccinations)
      .values({
        employeeId,
        vaccineId: vaccine.id,
        doseNumber: data.doseNumber,
        administeredAt: data.administeredAt || null,
        lotNumber: data.lotNumber || null,
        notes: data.notes || null,
        status: data.administeredAt ? "APLICADA" : "PENDENTE",
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

    for (const dayOffset of [30, 60, 90]) {
      const due = new Date(occurredAt);
      due.setDate(due.getDate() + dayOffset);
      await db.insert(biologicalAccidentFollowups).values({
        accidentId: created.id,
        dayOffset,
        dueDate: due.toISOString().slice(0, 10),
        status: "PENDENTE",
        createdBy: user.id,
        updatedBy: user.id,
      });
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
