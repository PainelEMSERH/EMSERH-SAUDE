import {
  addMonths,
  differenceInCalendarDays,
  format,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DeadlineStatus } from "@/types";

export const APP_TIMEZONE = "America/Fortaleza";

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
