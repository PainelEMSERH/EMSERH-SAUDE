import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { clinicAsoAttendances } from "@/db/schemas";
import { requirePermission, userCan } from "@/lib/auth/guard";
import { sha256Hex, toIsoDate } from "@/lib/clinic-aso/business";
import { extractClinicAsoOcr } from "@/lib/clinic-aso/ocr";
import { storeClinicAsoFile } from "@/lib/clinic-aso/storage";
import { EMPTY_CLINIC_ASO_FIELDS } from "@/lib/clinic-aso/types";

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

  return NextResponse.json({
    asoFileName: file.name,
    asoFileHash,
    asoBlobUrl: stored.url,
    duplicate,
    extraction,
    fields,
    pageCount: extraction.pageCount,
  });
}
