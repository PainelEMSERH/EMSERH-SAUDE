import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { clinicAsoAttendances } from "@/db/schemas";
import {
  lookupEmployeeByCpf,
  lookupEmployeeByRegistration,
  listClinicPhysicians,
} from "@/db/queries/clinic-aso";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { sha256Hex, toIsoDate } from "@/lib/clinic-aso/business";
import { extractClinicAsoOcr } from "@/lib/clinic-aso/ocr";
import { storeClinicAsoFile } from "@/lib/clinic-aso/storage";
import { EMPTY_CLINIC_ASO_FIELDS } from "@/lib/clinic-aso/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Sessão expirada. Faça login novamente." },
        { status: 401 },
      );
    }
    if (!can(user, "attendances", "view")) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    if (!can(user, "attendances", "create")) {
      return NextResponse.json(
        {
          error:
            "Seu perfil não pode cadastrar ASO. Peça acesso de criação em Atendimentos.",
        },
        { status: 403 },
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Arquivo obrigatório." },
        { status: 400 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: "Arquivo vazio." },
        { status: 400 },
      );
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Arquivo muito grande (máx. 25 MB)." },
        { status: 400 },
      );
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

    let stored: { url: string; storedName: string };
    try {
      stored = await storeClinicAsoFile(file.name, bytes);
    } catch (e) {
      console.error("[atendimento-aso/extract] store", e);
      return NextResponse.json(
        {
          error:
            e instanceof Error
              ? `Falha ao salvar o arquivo: ${e.message}`
              : "Falha ao salvar o arquivo.",
        },
        { status: 500 },
      );
    }

    let extraction;
    try {
      extraction = await extractClinicAsoOcr({
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        bytes,
      });
    } catch (e) {
      console.error("[atendimento-aso/extract] ocr", e);
      extraction = {
        provider: "none",
        rawText: "",
        pageCount: 1,
        fields: { ...EMPTY_CLINIC_ASO_FIELDS },
        error:
          e instanceof Error
            ? e.message
            : "Não foi possível ler o texto do PDF.",
      };
    }

    const fields = { ...EMPTY_CLINIC_ASO_FIELDS, ...extraction.fields };
    if (fields.date) fields.date = toIsoDate(fields.date) || fields.date;

    let physicians: Awaited<ReturnType<typeof listClinicPhysicians>> = [];
    try {
      physicians = await listClinicPhysicians();
      fields.physicianCode = matchPhysicianCode(physicians, fields);
    } catch (e) {
      console.error("[atendimento-aso/extract] physicians", e);
    }

    let employee: Awaited<
      ReturnType<typeof lookupEmployeeByRegistration>
    > = null;
    let employeeSource: "matricula" | "cpf" | null = null;

    try {
      if (fields.matricula && fields.matricula !== "00000") {
        employee = await lookupEmployeeByRegistration(
          user,
          fields.matricula.trim(),
        );
        if (employee) employeeSource = "matricula";
      }
      if (!employee && fields.cpf) {
        employee = await lookupEmployeeByCpf(user, fields.cpf);
        if (employee) {
          employeeSource = "cpf";
          fields.matricula = employee.registration;
        }
      }
    } catch (e) {
      console.error("[atendimento-aso/extract] employee", e);
    }

    const textLen = (extraction.rawText || "").replace(/\s+/g, " ").trim()
      .length;
    const lowText = textLen < 40;

    return NextResponse.json({
      asoFileName: file.name,
      asoFileHash,
      asoBlobUrl: stored.url,
      duplicate,
      extraction: {
        provider: extraction.provider,
        rawText: extraction.rawText?.slice(0, 8000) ?? "",
        pageCount: extraction.pageCount,
        fields: extraction.fields,
      },
      fields,
      pageCount: extraction.pageCount,
      textLength: textLen,
      lowText,
      employee,
      employeeSource,
      ocrError:
        "error" in extraction && typeof extraction.error === "string"
          ? extraction.error
          : null,
    });
  } catch (e) {
    console.error("[atendimento-aso/extract]", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Erro interno ao processar o ASO.",
      },
      { status: 500 },
    );
  }
}
