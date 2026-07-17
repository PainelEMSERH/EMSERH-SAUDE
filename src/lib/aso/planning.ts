/**
 * Helpers de planejamento mensal de ASOs.
 */
import type { Eligibility } from "./constants";

export function yearMonthFromDate(iso: string | null | undefined): {
  year: number;
  month: number;
} | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * Periodicidade no espelho/planilha às vezes vem como Excel date
 * (ex.: 11/01/1900 = 11 meses).
 */
export function parsePeriodicityMonths(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const asInt = Number.parseInt(trimmed, 10);
  if (!Number.isNaN(asInt) && String(asInt) === trimmed && asInt > 0 && asInt <= 60) {
    return asInt;
  }
  const br = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) {
    const day = Number(br[1]);
    const year = Number(br[3]);
    if (year === 1900 && day > 0 && day <= 60) return day;
  }
  const excelSerial = Number(trimmed);
  if (!Number.isNaN(excelSerial) && excelSerial > 0 && excelSerial <= 60) {
    return Math.round(excelSerial);
  }
  return null;
}

export function eligibilityFromFunctionalStatus(
  status: string | null | undefined,
): { eligibility: Eligibility; reason: string | null } {
  const s = (status || "").toUpperCase();
  // DEMITIDO não vira "justificado" de periódico: quem já saiu da empresa
  // simplesmente não entra no planejamento do ano/mês (ver dismissedBeforeCompetence).
  if (s === "AFASTADO") {
    return { eligibility: "JUSTIFICADO", reason: "AFASTADO" };
  }
  if (s === "FERIAS") {
    return { eligibility: "JUSTIFICADO", reason: "FERIAS" };
  }
  return { eligibility: "ELEGIVEL", reason: null };
}

/**
 * Demitido antes do 1º dia da competência → não pertence ao mês/ano.
 * Ex.: demissão 2025-01-06 → fora de qualquer competência de 2026.
 */
export function dismissedBeforeCompetence(
  dismissalDate: string | null | undefined,
  year: number,
  month: number,
): boolean {
  if (!dismissalDate) return false;
  const dem = yearMonthFromDate(dismissalDate);
  if (!dem) return false;
  if (dem.year < year) return true;
  if (dem.year > year) return false;
  return dem.month < month;
}

/** Demitido antes do início do ano de planejamento. */
export function dismissedBeforeYear(
  dismissalDate: string | null | undefined,
  year: number,
): boolean {
  if (!dismissalDate) return false;
  return dismissalDate.slice(0, 10) < `${year}-01-01`;
}

export function competenceIsFuture(year: number, month: number, now = new Date()): boolean {
  const cursor = now.getFullYear() * 12 + (now.getMonth() + 1);
  return year * 12 + month > cursor;
}

export function monthsInRange(
  year: number,
  fromMonth: number,
  toMonth: number,
): number[] {
  const out: number[] = [];
  for (let m = fromMonth; m <= toMonth; m++) out.push(m);
  return out;
}

/**
 * Monta uma URL preservando os parâmetros atuais e aplicando overrides.
 * `undefined`/`"ALL"` removem o parâmetro da URL.
 */
export function buildAsoUrl(
  basePath: string,
  current: Record<string, string | number | undefined>,
  overrides: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    if (!str || str === "ALL") continue;
    params.set(key, str);
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
