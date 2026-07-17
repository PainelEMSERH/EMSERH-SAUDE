/** Vacinas institucionais + situações da planilha da enfermagem. */

export const VACCINE_DEFS = [
  { code: "TETANO", label: "Tétano", shortLabel: "Tétano" },
  { code: "HEPATITE_B", label: "Hepatite B", shortLabel: "Hepatite B" },
  { code: "TRIPLICE", label: "Tríplice viral", shortLabel: "Tríplice" },
  { code: "FEBRE_AMARELA", label: "Febre amarela", shortLabel: "Febre am." },
  { code: "H1N1", label: "Influenza / H1N1", shortLabel: "H1N1" },
  { code: "COVID", label: "COVID-19", shortLabel: "COVID" },
] as const;

export type VaccineCode = (typeof VACCINE_DEFS)[number]["code"];

/** Situações exatamente como na planilha (valores persistidos / importados). */
export const VACCINE_SITUATIONS: Record<VaccineCode, readonly string[]> = {
  TETANO: [
    "1  dose",
    "1 e 2 dose",
    "1,2 e 3 dose",
    "Dose de reforço mais de 10 anos",
    "Dose de reforço menos de 10 anos",
    "Termo de Recusa",
  ],
  HEPATITE_B: [
    "1  dose",
    "1 e 2 dose",
    "1,2 e 3 dose",
    "Ant Hbs Reagente",
    "Termo de Recusa",
  ],
  TRIPLICE: [
    "1  dose Maior de 29 anos",
    "1 dose menor de 29 anos",
    "2 doses menor de 29 anos",
    "Maior de 60",
    "Termo de Recusa",
  ],
  FEBRE_AMARELA: ["1  dose", "Termo de Recusa"],
  H1N1: [
    "1 dose menos de um ano",
    "1 dose a mais de um ano",
    "Termo de Recusa",
  ],
  COVID: [
    "1 dose menos de um ano",
    "1 dose a mais de um ano",
    "Termo de Recusa",
  ],
};

export const DEFAULT_VACCINE: VaccineCode = "TETANO";

export type SituationKind = "ok" | "partial" | "attention" | "refusal" | "unknown";

export function resolveVaccineCode(raw?: string | null): VaccineCode {
  const c = (raw ?? "").trim().toUpperCase();
  if (VACCINE_DEFS.some((v) => v.code === c)) return c as VaccineCode;
  return DEFAULT_VACCINE;
}

export function vaccineLabel(code: string | null | undefined): string {
  const found = VACCINE_DEFS.find((v) => v.code === code);
  return found?.label ?? code ?? "—";
}

/** Extrai situações por vacina do campo notes importado. */
export function parseVaccinationNotes(
  notes: string | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!notes?.trim()) return out;
  for (const part of notes.split("|")) {
    const m = part.trim().match(/^([A-Za-z0-9_]+)\s*:\s*(.+)$/);
    if (!m) continue;
    out[m[1].toUpperCase()] = m[2].trim();
  }
  return out;
}

export function classifySituation(
  vaccineCode: string,
  situation: string | null | undefined,
): SituationKind {
  const s = (situation ?? "").trim().toLowerCase();
  if (!s) return "unknown";
  if (s.includes("termo de recusa") || s.includes("recusa")) return "refusal";
  if (s.includes("ant hbs")) return "ok";
  if (s.includes("mais de 10")) return "attention";
  if (s.includes("1,2 e 3") || s.includes("1,2 e 3 dose")) return "ok";
  if (s.includes("menos de 10") || s.includes("menos de um ano")) return "ok";
  if (s.includes("maior de 60") || s.includes("maior de 29")) return "ok";
  if (s.includes("a mais de um ano")) return "attention";
  if (s.includes("1 e 2") || s.includes("2 doses") || s.includes("1  dose") || s.includes("1 dose"))
    return "partial";
  if (vaccineCode === "FEBRE_AMARELA" && s.includes("dose")) return "ok";
  return "unknown";
}

export function situationTone(
  kind: SituationKind,
): "ok" | "warn" | "danger" | "info" | "muted" {
  switch (kind) {
    case "ok":
      return "ok";
    case "partial":
      return "info";
    case "attention":
      return "warn";
    case "refusal":
      return "danger";
    default:
      return "muted";
  }
}

/** Dose numérica aproximada para persistência (índice / ordenação). */
export function doseNumberFromSituation(situation: string): number {
  const s = situation.toLowerCase();
  if (s.includes("termo de recusa")) return 0;
  if (s.includes("1,2 e 3") || s.includes("ant hbs") || s.includes("reforço"))
    return 3;
  if (s.includes("1 e 2") || s.includes("2 doses")) return 2;
  return 1;
}

export function buildVaccinationUrl(
  base: string,
  current: Record<string, string | number | undefined>,
  patch: Record<string, string | number | undefined | null>,
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...patch };
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (!s || s === "ALL") continue;
    params.set(k, s);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
