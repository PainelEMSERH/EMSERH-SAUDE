import { clinicEnv } from "@/lib/clinic-aso/env";
import { toIsoDate } from "@/lib/clinic-aso/business";
import {
  CLINIC_ATTENDANCE_TYPES,
  CLINIC_LIFESTYLE,
  CLINIC_SEX,
  CLINIC_SITUATIONS,
  CLINIC_YES_NO,
  EMPTY_CLINIC_ASO_FIELDS,
  type ClinicAsoFormFields,
  type ClinicAttendanceType,
  type ClinicLifestyle,
  type ClinicSex,
  type ClinicSituation,
  type ClinicYesNo,
} from "@/lib/clinic-aso/types";

export type ClinicOcrExtraction = {
  provider: string;
  rawText: string;
  pageCount: number;
  fields: ClinicAsoFormFields;
};

function pickEnum<T extends string>(
  value: string | null | undefined,
  options: readonly T[],
): T | null {
  if (!value) return null;
  const n = value.trim().toLowerCase();
  return options.find((o) => o.toLowerCase() === n) ?? null;
}

function matchAttendance(text: string): ClinicAttendanceType | null {
  const map: Array<[RegExp, ClinicAttendanceType]> = [
    [/admissional/i, "Admissional"],
    [/demissional/i, "Demissional"],
    [/retorno\s+ao\s+trabalho/i, "Retorno ao Trabalho"],
    [/mudan[cç]a\s+de\s+fun[cç][aã]o/i, "Mudança de Função"],
    [/peri[oó]dico/i, "Periódico"],
    [/consulta/i, "Consulta"],
  ];
  for (const [re, v] of map) {
    if (re.test(text)) return v;
  }
  return null;
}

function matchSituation(text: string): ClinicSituation | null {
  if (/\binapto\b/i.test(text)) return "Inapto";
  if (/\brealizada\b/i.test(text)) return "Realizada";
  if (/\bapto\b/i.test(text)) return "Apto";
  return null;
}

function extractByLabels(text: string, labels: RegExp[]): string | null {
  for (const label of labels) {
    const m = text.match(label);
    if (m?.[1]) {
      const v = m[1].trim().replace(/\s+/g, " ");
      if (v) return v;
    }
  }
  return null;
}

export function parseClinicAsoFieldsFromText(
  rawText: string,
): ClinicAsoFormFields {
  const fields: ClinicAsoFormFields = { ...EMPTY_CLINIC_ASO_FIELDS };
  const text = rawText || "";
  if (!text.trim()) return fields;

  fields.cpf = extractByLabels(text, [
    /CPF[:\s]*([\d.\-\/]+)/i,
    /C\.?P\.?F\.?[:\s]*([\d.\-\/]+)/i,
    /(?:^|\n)\s*([\d]{3}\.[\d]{3}\.[\d]{3}-[\d]{2})\b/,
  ]);
  fields.matricula = extractByLabels(text, [
    /Matr[ií]cula[:\s#]*([0-9]+)/i,
    /Cd\.?\s*Chamada[:\s]*([0-9]+)/i,
    /CdChamada[:\s]*([0-9]+)/i,
    /Registro[:\s]*([0-9]+)/i,
    /Chapa[:\s]*([0-9]+)/i,
  ]);
  const name = extractByLabels(text, [
    /Nome\s+do\s+(?:Funcion[aá]rio|Colaborador|Trabalhador)[:\s]*([A-ZÀ-Ú\s.'-]{5,})/i,
    /Colaborador[:\s]*([A-ZÀ-Ú\s.'-]{5,})/i,
    /Nome[:\s]*([A-ZÀ-Ú\s.'-]{5,})/i,
  ]);
  fields.employeeName = name ? name.toUpperCase() : null;

  const dateRaw = extractByLabels(text, [
    /Data\s+do\s+(?:exame|ASO|atendimento)[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
    /Data[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
    /(\d{2}\/\d{2}\/\d{4})/,
  ]);
  fields.date = dateRaw ? toIsoDate(dateRaw) : null;

  const birthRaw = extractByLabels(text, [
    /Nascimento[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
    /Data\s+Nasc[:\s]*(\d{2}\/\d{2}\/\d{4})/i,
  ]);
  fields.birthDate = birthRaw ? toIsoDate(birthRaw) : null;

  fields.attendanceType = matchAttendance(text);
  fields.situation = matchSituation(text);
  fields.physicianCode = extractByLabels(text, [
    /C[oó]d(?:igo)?\.?\s*M[eé]dico[:\s]*(\d+)/i,
    /CRM[:\s]*(\d+)/i,
  ]);
  fields.physicianName = extractByLabels(text, [
    /M[eé]dico[:\s]*([A-Za-zÀ-ú\s.]{3,60})/i,
  ]);
  fields.weight = extractByLabels(text, [/Peso[:\s]*([\d.,]+)/i]);
  fields.height = extractByLabels(text, [/Altura[:\s]*([\d.,]+)/i]);
  fields.department = extractByLabels(text, [
    /Departamento[:\s]*([^\n]+)/i,
    /Setor[:\s]*([^\n]+)/i,
  ]);
  fields.jobTitle = extractByLabels(text, [
    /Fun[cç][aã]o[:\s]*([^\n]+)/i,
    /Cargo[:\s]*([^\n]+)/i,
  ]);
  fields.city = extractByLabels(text, [/Cidade[:\s]*([^\n]+)/i]);
  fields.sus = extractByLabels(text, [
    /SUS[:\s]*([\d.\-]+)/i,
    /CNS[:\s]*([\d.\-]+)/i,
  ]);

  if (/\bmasculino\b/i.test(text) || /\bsexo[:\s]*m\b/i.test(text)) {
    fields.sex = "Masculino";
  } else if (/\bfeminino\b/i.test(text) || /\bsexo[:\s]*f\b/i.test(text)) {
    fields.sex = "Feminino";
  }

  if (/\batividade[s]?\s+f[ií]sica[s]?[:\s]*sim\b/i.test(text)) {
    fields.physicalActivity = "Sim";
  } else if (/\batividade[s]?\s+f[ií]sica[s]?[:\s]*n[aã]o\b/i.test(text)) {
    fields.physicalActivity = "Não";
  }

  for (const opt of CLINIC_LIFESTYLE) {
    if (text.toLowerCase().includes(opt.toLowerCase())) {
      fields.lifestyle = opt;
      break;
    }
  }

  fields.conduct = extractByLabels(text, [/Conduta[:\s]*([^\n]+)/i]);
  fields.notes = extractByLabels(text, [
    /OBS[:\s]*([^\n]+)/i,
    /Observa[cç][oõ]es[:\s]*([^\n]+)/i,
  ]);
  fields.profile = extractByLabels(text, [/Perfil[:\s]*([^\n]+)/i]);

  fields.attendanceType = pickEnum(
    fields.attendanceType,
    CLINIC_ATTENDANCE_TYPES,
  );
  fields.situation = pickEnum(fields.situation, CLINIC_SITUATIONS);
  fields.sex = pickEnum(fields.sex, CLINIC_SEX) as ClinicSex | null;
  fields.physicalActivity = pickEnum(
    fields.physicalActivity,
    CLINIC_YES_NO,
  ) as ClinicYesNo | null;
  fields.lifestyle = pickEnum(
    fields.lifestyle,
    CLINIC_LIFESTYLE,
  ) as ClinicLifestyle | null;

  return fields;
}

async function extractPdfText(
  bytes: Buffer,
): Promise<{ text: string; pageCount: number }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const pageCount = pdf.numPages ?? 0;
  const { text } = await extractText(pdf, { mergePages: true });
  const raw = Array.isArray(text) ? text.join("\n\n") : String(text ?? "");
  return { text: raw, pageCount };
}

/** OCR multipágina: extrai texto do PDF — nunca envia PDF como image_url. */
export async function extractClinicAsoOcr(input: {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<ClinicOcrExtraction> {
  const provider = clinicEnv("OCR_PROVIDER", "none").toLowerCase();
  const isPdf =
    input.mimeType.includes("pdf") ||
    input.fileName.toLowerCase().endsWith(".pdf");

  let rawText = "";
  let pageCount = 1;
  if (isPdf) {
    try {
      const extracted = await extractPdfText(input.bytes);
      rawText = extracted.text;
      pageCount = extracted.pageCount || 1;
    } catch (e) {
      console.error("[clinic-aso/ocr] extractPdfText", e);
      rawText = "";
      pageCount = 1;
    }
  }

  if (provider === "none" || provider === "mock") {
    return {
      provider,
      rawText,
      pageCount,
      fields: parseClinicAsoFieldsFromText(rawText),
    };
  }

  const apiKey = clinicEnv("OCR_API_KEY");
  if (!apiKey) throw new Error("OCR_API_KEY não configurada.");

  if (provider === "openai") {
    if (!rawText.trim()) {
      return {
        provider,
        rawText: "",
        pageCount,
        fields: { ...EMPTY_CLINIC_ASO_FIELDS },
      };
    }
    const model = clinicEnv("OCR_MODEL", "gpt-4o-mini");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "Extraia dados de ASO do TEXTO do PDF. Use null se ausente. Nunca invente.",
          },
          {
            role: "user",
            content: `Arquivo: ${input.fileName}\n\n${rawText.slice(0, 120000)}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`OCR OpenAI falhou (${res.status}).`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as Partial<ClinicAsoFormFields>;
    const base = parseClinicAsoFieldsFromText(rawText);
    const fields: ClinicAsoFormFields = { ...EMPTY_CLINIC_ASO_FIELDS };
    for (const key of Object.keys(
      EMPTY_CLINIC_ASO_FIELDS,
    ) as Array<keyof ClinicAsoFormFields>) {
      fields[key] = (parsed[key] ?? base[key] ?? null) as never;
    }
    return { provider, rawText: content, pageCount, fields };
  }

  throw new Error(`OCR_PROVIDER não suportado: ${provider}`);
}
