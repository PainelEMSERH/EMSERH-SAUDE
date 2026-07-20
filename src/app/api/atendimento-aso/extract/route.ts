import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { clinicAsoAttendances } from "@/db/schemas";
import {
  lookupEmployeeByCpf,
  lookupEmployeeByRegistration,
  listClinicPhysicians,
} from "@/db/queries/clinic-aso";
import { requirePermission, userCan } from "@/lib/auth/guard";
import { sha256Hex, toIsoDate } from "@/lib/clinic-aso/business";
import { extractClinicAsoOcr } from "@/lib/clinic-aso/ocr";
import { storeClinicAsoFile } from "@/lib/clinic-aso/storage";
import { EMPTY_CLINIC_ASO_FIELDS } from "@/lib/clinic-aso/types";

function matchPhysicianCode(
  physicians: Array<{ code: string | null; name: string; crm: string | null }>,
  fields: { physicianCode: string | null; physicianName: string | null },
): string | null {
  if (fields.physicianCode) {
    const byCode = physicians.find(
      (p) => p.code && p.code === fields.physicianCode,
    );
    if (byCode?.code) return byCode.code;
  }
  const nameHint = (fields.physicianName || "").toLowerCase();
  if (nameHint.length >= 3) {
    const byName = physicians.find((p) =>
      nameHint.includes(p.name.toLowerCase()),
    );
    if (byName?.code) return byName.code;
  }
  const textCode = fields.physicianCode;
  if (textCode) {
    const soft = physicians.find(
      (p) => p.crm && p.crm.replace(/\D/g, "").includes(textCode),
    );
    if (soft?.code) return soft.code;
  }
  return fields.physicianCode;
}

export async function POST(req: Request) {
  const user = await requirePermission("attendances", "view");
  if (!userCan(user, "attendances", "create")) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo obrigatório." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const asoFileHash = sha256Hex(bytes);

  let duplicate = false;
  try {
    const db = getDb();
    const [existing] = await db
      .select({ id: clinicAsoAttendances.id })
      .from(clinicAsoAttendances)
      .where(
        and(
          eq(clinicAsoAttendances.asoFileHash, asoFileHash),
          isNull(clinicAsoAttendances.deletedAt),
        ),
      )
      .limit(1);
    duplicate = Boolean(existing);
  } catch {
    /* tabela ainda não migrada */
  }

  const stored = await storeClinicAsoFile(file.name, bytes);
  const extraction = await extractClinicAsoOcr({
    fileName: file.name,
    mimeType: file.type || "application/pdf",
    bytes,
  });

  const fields = { ...EMPTY_CLINIC_ASO_FIELDS, ...extraction.fields };
  if (fields.date) fields.date = toIsoDate(fields.date) || fields.date;

  const physicians = await listClinicPhysicians();
  fields.physicianCode = matchPhysicianCode(physicians, fields);

  let employee: Awaited<ReturnType<typeof lookupEmployeeByRegistration>> = null;
  let employeeSource: "matricula" | "cpf" | null = null;

  if (fields.matricula && fields.matricula !== "00000") {
    employee = await lookupEmployeeByRegistration(user, fields.matricula.trim());
    if (employee) employeeSource = "matricula";
  }
  if (!employee && fields.cpf) {
    employee = await lookupEmployeeByCpf(user, fields.cpf);
    if (employee) {
      employeeSource = "cpf";
      fields.matricula = employee.registration;
    }
  }

  const textLen = (extraction.rawText || "").replace(/\s+/g, " ").trim().length;
  const lowText = textLen < 40;

  return NextResponse.json({
    asoFileName: file.name,
    asoFileHash,
    asoBlobUrl: stored.url,
    duplicate,
    extraction,
    fields,
    pageCount: extraction.pageCount,
    textLength: textLen,
    lowText,
    employee,
    employeeSource,
  });
}
