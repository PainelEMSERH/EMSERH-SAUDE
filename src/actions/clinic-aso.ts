"use server";

import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { clinicAsoAttendances, physicians } from "@/db/schemas";
import {
  ensureDefaultClinicPhysicians,
  lookupEmployeeByRegistration,
} from "@/db/queries/clinic-aso";
import { requirePermission } from "@/lib/auth/guard";
import {
  calculateAge,
  calculateBmi,
  classifyBmi,
  isValidCpf,
  normalizeCpf,
  normalizeRegistration,
  situationForAttendance,
  toIsoDate,
} from "@/lib/clinic-aso/business";
import {
  CLINIC_ATTENDANCE_TYPES,
  CLINIC_LIFESTYLE,
  CLINIC_SEX,
  CLINIC_SITUATIONS,
  CLINIC_YES_NO,
} from "@/lib/clinic-aso/types";
import { uploadClinicAsoToDrive } from "@/lib/clinic-aso/drive";
import {
  buildClinicAsoEmail,
  sendClinicMail,
} from "@/lib/clinic-aso/email";
import { loadClinicAsoBytes } from "@/lib/clinic-aso/storage";
import { clinicEnv } from "@/lib/clinic-aso/env";

const createSchema = z.object({
  date: z.string().min(8),
  matricula: z.string(),
  attendanceType: z.enum(CLINIC_ATTENDANCE_TYPES),
  situation: z.enum(CLINIC_SITUATIONS),
  conduct: z.string().optional().default(""),
  physicianCode: z.string().min(1),
  notes: z.string().optional().default(""),
  physicalActivity: z.enum(CLINIC_YES_NO),
  lifestyle: z.enum(CLINIC_LIFESTYLE),
  sex: z.enum(CLINIC_SEX).optional(),
  weight: z.coerce.number().positive().nullable().optional(),
  height: z.coerce.number().positive().nullable().optional(),
  profile: z.string().optional().default(""),
  employeeName: z.string().optional().default(""),
  department: z.string().optional().default(""),
  jobTitle: z.string().optional().default(""),
  cpf: z.string().optional().default(""),
  sus: z.string().optional().default(""),
  city: z.string().optional().default(""),
  birthDate: z.string().nullable().optional(),
  asoFileName: z.string().nullable().optional(),
  asoFileHash: z.string().nullable().optional(),
  asoBlobUrl: z.string().nullable().optional(),
  extractionRaw: z.unknown().optional(),
});

export async function lookupClinicEmployeeAction(registration: string) {
  const user = await requirePermission("attendances", "view");
  const reg = registration.trim();
  if (!reg) return { error: "Informe a matrícula." };
  const emp = await lookupEmployeeByRegistration(user, reg);
  if (!emp) return { error: "Colaborador não encontrado no Alterdata." };
  return { ok: true as const, employee: emp };
}

export async function createClinicAttendanceAction(input: unknown) {
  const user = await requirePermission("attendances", "create");
  await ensureDefaultClinicPhysicians();

  try {
    const data = createSchema.parse(input);
    const date = toIsoDate(data.date);
    if (!date) return { error: "Data inválida." };

    const registration = normalizeRegistration(
      data.matricula,
      data.attendanceType,
    );
    if (!registration) return { error: "Matrícula obrigatória." };

    const db = getDb();

    let employeeId: string | null = null;
    let employeeName = "";
    let department = "";
    let jobTitle = "";
    let cpf = "";
    let city = "";
    let birthDate: string | null = null;
    let sex = data.sex || "Masculino";
    const sus = (data.sus || "").replace(/\D/g, "");
    let unitId: string | null = null;
    let regionId: string | null = null;

    if (data.attendanceType === "Admissional") {
      employeeName = (data.employeeName || "").toUpperCase();
      department = data.department || "";
      jobTitle = data.jobTitle || "";
      cpf = data.cpf ? normalizeCpf(data.cpf) : "";
      city = data.city || "";
      birthDate = data.birthDate ? toIsoDate(data.birthDate) : null;
      sex = data.sex || "Masculino";
      if (employeeName.length < 3) {
        return { error: "Nome obrigatório no admissional." };
      }
      if (cpf && !isValidCpf(cpf)) return { error: "CPF inválido." };
    } else {
      const emp = await lookupEmployeeByRegistration(user, registration);
      if (!emp) {
        return {
          error:
            "Colaborador não encontrado no Alterdata para esta matrícula.",
        };
      }
      employeeId = emp.id;
      employeeName = emp.fullName;
      department = emp.department;
      jobTitle = emp.jobTitle;
      cpf = emp.cpf ? normalizeCpf(emp.cpf) : "";
      city = emp.city;
      birthDate = emp.birthDate;
      sex =
        emp.sex === "Masculino" || emp.sex === "Feminino"
          ? emp.sex
          : data.sex || "Masculino";
      unitId = emp.unitId;
      regionId = emp.regionId;
    }

    if (data.asoFileHash) {
      const [dup] = await db
        .select({ id: clinicAsoAttendances.id })
        .from(clinicAsoAttendances)
        .where(
          and(
            eq(clinicAsoAttendances.asoFileHash, data.asoFileHash),
            isNull(clinicAsoAttendances.deletedAt),
          ),
        )
        .limit(1);
      if (dup) {
        return { error: "Este ASO já foi cadastrado.", duplicateId: dup.id };
      }
    }

    const [physician] = await db
      .select()
      .from(physicians)
      .where(
        and(
          eq(physicians.code, data.physicianCode),
          eq(physicians.isActive, true),
          isNull(physicians.deletedAt),
        ),
      )
      .limit(1);
    if (!physician) {
      return { error: "Código do médico não cadastrado." };
    }

    const bmi = calculateBmi(data.weight, data.height);
    const age = calculateAge(birthDate, new Date(date + "T12:00:00"));

    const [rec] = await db
      .insert(clinicAsoAttendances)
      .values({
        attendanceDate: date,
        registration,
        employeeId,
        employeeName: employeeName.toUpperCase(),
        department,
        jobTitle,
        cpf: cpf || "",
        sus,
        attendanceType: data.attendanceType,
        situation: situationForAttendance(
          data.attendanceType,
          data.situation,
        ),
        conduct: data.conduct,
        physicianCode: physician.code || data.physicianCode,
        physicianName: physician.name,
        notes: data.notes,
        physicalActivity: data.physicalActivity,
        lifestyle: data.lifestyle,
        sex,
        weight: data.weight?.toString() || null,
        height: data.height?.toString() || null,
        bmi: bmi?.toString() || null,
        bmiResult: classifyBmi(bmi),
        profile: data.profile,
        city,
        birthDate,
        age,
        asoFileName: data.asoFileName,
        asoFileHash: data.asoFileHash,
        asoBlobUrl: data.asoBlobUrl,
        extractionStatus: data.extractionRaw ? "CONFIRMED" : "NONE",
        extractionRaw: data.extractionRaw ?? null,
        unitId,
        regionId,
        physicianId: physician.id,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    revalidatePath("/atendimento-aso");
    return { ok: true as const, record: rec };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { error: "Revise os campos obrigatórios." };
    }
    return { error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

export async function archiveClinicAttendanceAction(id: string) {
  const user = await requirePermission("attendances", "update");
  const db = getDb();
  const [rec] = await db
    .select()
    .from(clinicAsoAttendances)
    .where(
      and(
        eq(clinicAsoAttendances.id, id),
        isNull(clinicAsoAttendances.deletedAt),
      ),
    )
    .limit(1);
  if (!rec) return { error: "Registro não encontrado." };
  if (rec.driveUrl) return { ok: true as const, driveUrl: rec.driveUrl };

  try {
    const bytes = await loadClinicAsoBytes(rec.asoBlobUrl);
    if (!bytes) {
      return { error: "Registro sem arquivo ASO para arquivar." };
    }
    const fileName =
      rec.asoFileName ||
      `ASO_${rec.registration}_${rec.attendanceType}_${rec.attendanceDate}.pdf`;
    const uploaded = await uploadClinicAsoToDrive({ fileName, bytes });
    await db
      .update(clinicAsoAttendances)
      .set({
        driveFileId: uploaded.fileId,
        driveUrl: uploaded.webViewLink,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(clinicAsoAttendances.id, id));
    revalidatePath("/atendimento-aso");
    return { ok: true as const, driveUrl: uploaded.webViewLink };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro no Drive" };
  }
}

export async function emailClinicAttendanceAction(id: string) {
  const user = await requirePermission("attendances", "update");
  const db = getDb();
  const [rec] = await db
    .select()
    .from(clinicAsoAttendances)
    .where(
      and(
        eq(clinicAsoAttendances.id, id),
        isNull(clinicAsoAttendances.deletedAt),
      ),
    )
    .limit(1);
  if (!rec) return { error: "Registro não encontrado." };

  const to = clinicEnv("ASO_EMAIL_TO") || user.email;
  if (!to) return { error: "Defina ASO_EMAIL_TO." };

  try {
    const pdfBytes = await loadClinicAsoBytes(rec.asoBlobUrl);
    if (!pdfBytes) {
      return { error: "Registro sem arquivo ASO para anexar ao e-mail." };
    }
    const filename =
      rec.asoFileName ||
      `ASO_${rec.registration}_${rec.attendanceType}_${rec.attendanceDate}.pdf`;
    const mail = buildClinicAsoEmail({
      to,
      employeeName: rec.employeeName,
      registration: rec.registration,
      attendanceType: rec.attendanceType,
      situation: rec.situation,
      date: rec.attendanceDate,
      physicianName: rec.physicianName,
      physicianCode: rec.physicianCode,
      driveUrl: rec.driveUrl,
      pdfBytes,
      filename,
    });
    await sendClinicMail(mail);
    await db
      .update(clinicAsoAttendances)
      .set({
        emailStatus: "SENT",
        emailError: null,
        emailSentAt: new Date(),
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(clinicAsoAttendances.id, id));
    revalidatePath("/atendimento-aso");
    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro no envio";
    await db
      .update(clinicAsoAttendances)
      .set({
        emailStatus: "ERROR",
        emailError: msg,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(clinicAsoAttendances.id, id));
    return { error: msg };
  }
}
