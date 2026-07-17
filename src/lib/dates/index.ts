import {
  addMonths,
  differenceInCalendarDays,
  format,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DeadlineStatus } from "@/types";

export const APP_TIMEZONE = "America/Fortaleza";

/**
 * Parse de datas vindas de planilha/espelho (BR).
 * Nunca usar `new Date("DD/MM/YYYY")` — o V8 interpreta como MM/DD (EUA).
 * Ex.: "04/08/2026" viraria 8 de abril em vez de 4 de agosto.
 */
export function parseSheetDate(
  value: string | number | null | undefined,
): string | null {
  if (value == null || value === "") return null;

  if (typeof value === "number") {
    if (value >= 20000 && value <= 60000) {
      const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000);
      return utc.toISOString().slice(0, 10);
    }
    return null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  if (/^\d+(\.\d+)?$/.test(raw)) {
    return parseSheetDate(Number(raw));
  }

  // BR: DD/MM/YYYY (com ou sem hora)
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]);
    const year = Number(br[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return null;
  }

  return null;
}

export function formatDateBR(
  value: Date | string | null | undefined,
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

export function formatDateTimeBR(
  value: Date | string | null | undefined,
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

/** Adiciona meses reais (não aproxima por dias). */
export function addRealMonths(date: Date, months: number): Date {
  return addMonths(date, months);
}

export function computeDeadlineStatus(
  nextDate: Date | null | undefined,
  warnDays = 30,
): DeadlineStatus {
  if (!nextDate) return "NAO_APLICAVEL";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(nextDate);
  target.setHours(0, 0, 0, 0);
  const diff = differenceInCalendarDays(target, today);
  if (diff < 0) return "VENCIDO";
  if (diff <= warnDays) return "A_VENCER";
  return "EM_DIA";
}

export function calcLeaveDays(start: Date, end: Date): number {
  return differenceInCalendarDays(end, start) + 1;
}

export function calcImc(
  weightKg: number,
  heightCm: number,
): number | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const meters = heightCm / 100;
  return Math.round((weightKg / (meters * meters)) * 100) / 100;
}
