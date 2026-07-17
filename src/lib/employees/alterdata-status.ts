import { normalizeText } from "@/lib/validation";
import { parseSheetDate } from "@/lib/dates";

/**
 * True se o colaborador está em afastamento na data de referência
 * (início <= hoje e (sem fim ou fim >= hoje)).
 */
export function isActiveLeavePeriod(
  startRaw?: string | number | null,
  endRaw?: string | number | null,
  todayIso: string = new Date().toISOString().slice(0, 10),
): boolean {
  const start = parseSheetDate(startRaw ?? null);
  if (!start) return false;
  if (start > todayIso) return false;
  const end = parseSheetDate(endRaw ?? null);
  if (!end) return true;
  return end >= todayIso;
}

/** Último dia do mês (YYYY-MM-DD). */
export function monthEndIso(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}

/**
 * Período [início, fim] cruza a competência (ano/mês)?
 * Sem data de início → não assume afastamento/férias.
 */
export function periodOverlapsCompetence(
  startRaw?: string | number | null,
  endRaw?: string | number | null,
  year?: number,
  month?: number,
): boolean {
  if (year == null || month == null || month < 1 || month > 12) return false;
  const start = parseSheetDate(startRaw ?? null);
  if (!start) return false;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = monthEndIso(year, month);
  const end = parseSheetDate(endRaw ?? null) || "9999-12-31";
  return start <= monthEnd && end >= monthStart;
}

/**
 * Férias/afastamento só tiram da meta se cobrirem o mês INTEIRO.
 * Se sobrou qualquer dia no mês fora do período, havia janela para o exame.
 */
export function leaveCoversEntireCompetence(
  startRaw?: string | number | null,
  endRaw?: string | number | null,
  year?: number,
  month?: number,
): boolean {
  if (year == null || month == null || month < 1 || month > 12) return false;
  const start = parseSheetDate(startRaw ?? null);
  if (!start) return false;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = monthEndIso(year, month);
  const end = parseSheetDate(endRaw ?? null) || "9999-12-31";
  return start <= monthStart && end >= monthEnd;
}

/**
 * Situação funcional PARA UMA COMPETÊNCIA (mês do plano).
 * Não usa Status_Férias “atual” nem “hoje” — só datas.
 * Férias/afastamento parciais NÃO justificam (havia janela no mês).
 */
export function functionalStatusForCompetence(input: {
  dismissalRaw?: string;
  feriasStartRaw?: string | number | null;
  feriasEndRaw?: string | number | null;
  leaveStartRaw?: string | number | null;
  leaveEndRaw?: string | number | null;
  year: number;
  month: number;
}): string {
  const demissao = (input.dismissalRaw || "").trim();
  if (demissao) {
    const dem = parseSheetDate(demissao);
    if (dem && dem < `${input.year}-01-01`) return "DEMITIDO";
  }

  if (
    leaveCoversEntireCompetence(
      input.feriasStartRaw,
      input.feriasEndRaw,
      input.year,
      input.month,
    )
  ) {
    return "FERIAS";
  }

  if (
    leaveCoversEntireCompetence(
      input.leaveStartRaw,
      input.leaveEndRaw,
      input.year,
      input.month,
    )
  ) {
    return "AFASTADO";
  }

  return "ATIVO";
}

/**
 * Situação funcional “agora” (sync ao vivo do colaborador).
 * Para elegibilidade de plano mensal, use `functionalStatusForCompetence`.
 */
export function mapAlterdataFunctionalStatus(input: {
  dismissalRaw?: string;
  statusAso?: string;
  afastamentoRaw?: string;
  statusFerias?: string;
  leaveStartRaw?: string | number | null;
  leaveEndRaw?: string | number | null;
  feriasStartRaw?: string | number | null;
  feriasEndRaw?: string | number | null;
  todayIso?: string;
}): string {
  const demissao = (input.dismissalRaw || "").trim();
  if (demissao) return "DEMITIDO";

  const statusAso = normalizeText(input.statusAso || "");
  if (statusAso.includes("DEMIT")) return "DEMITIDO";

  const today = input.todayIso ?? new Date().toISOString().slice(0, 10);

  if (isActiveLeavePeriod(input.feriasStartRaw, input.feriasEndRaw, today)) {
    return "FERIAS";
  }

  const ferias = normalizeText(
    `${input.statusFerias || ""} ${input.statusAso || ""}`,
  );
  const feriasStart = parseSheetDate(input.feriasStartRaw ?? null);
  if (
    (ferias.includes("FERIAS") ||
      ferias.includes("EM FERIAS") ||
      ferias === "FERIAS") &&
    (!feriasStart || feriasStart <= today)
  ) {
    const feriasEnd = parseSheetDate(input.feriasEndRaw ?? null);
    if (!feriasEnd || feriasEnd >= today) return "FERIAS";
  }

  if (isActiveLeavePeriod(input.leaveStartRaw, input.leaveEndRaw, today)) {
    return "AFASTADO";
  }

  const afast = normalizeText(
    `${input.afastamentoRaw || ""} ${input.statusAso || ""}`,
  );
  // "10 - Atestados" etc. não são afastamento ativo sem datas.
  if (
    (afast.includes("AFAST") ||
      afast.includes("LICENCA") ||
      afast.includes("INSS") ||
      afast.includes("MATERNIDADE")) &&
    !/^\d+\s*-/.test(String(input.afastamentoRaw || "").trim())
  ) {
    return "AFASTADO";
  }

  return "ATIVO";
}

export function mapAlterdataSex(raw: string): string | null {
  const n = normalizeText(raw);
  if (!n) return null;
  if (n.startsWith("F") || n === "FEMININO") return "F";
  if (n.startsWith("M") || n === "MASCULINO") return "M";
  return raw.trim().slice(0, 20) || null;
}
