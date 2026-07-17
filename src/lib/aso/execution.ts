/**
 * Regras centrais de execução ASO — usadas em cards, prioridades,
 * matriz, relação nominal e exportação. Sem duplicar lógica na UI.
 */

import type { Eligibility, ExecutionStatus } from "./constants";

const CLOSED_EXECUTION = new Set<string>([
  "REALIZADO",
  "JUSTIFICADO",
  "DISPENSADO",
]);

/** Motivos que podem retirar do denominador (elegibilidade JUSTIFICADO). */
export const DENOMINATOR_EXCLUSION_REASONS = new Set([
  "AFASTADO",
  "FERIAS",
  "DEMITIDO",
  "LICENCA",
  "DISPENSADO",
  "DISPENSA",
  "REPROGRAMACAO",
]);

/** Motivos que NÃO excluem do denominador (permanece elegível, status JUSTIFICADO/NAO_REALIZADO). */
export const NON_EXCLUSION_REASONS = new Set([
  "RECUSA",
  "FALTA",
  "OUTRO",
]);

export const JUSTIFY_REASONS = [
  { value: "AFASTADO", label: "Afastado", excludesDenominator: true },
  { value: "FERIAS", label: "Férias", excludesDenominator: true },
  { value: "DEMITIDO", label: "Demitido", excludesDenominator: true },
  { value: "LICENCA", label: "Licença", excludesDenominator: true },
  { value: "RECUSA", label: "Recusa", excludesDenominator: false },
  { value: "FALTA", label: "Falta", excludesDenominator: false },
  { value: "REPROGRAMACAO", label: "Reprogramação", excludesDenominator: true },
  { value: "DISPENSA", label: "Dispensa", excludesDenominator: true },
  { value: "OUTRO", label: "Outro", excludesDenominator: false },
] as const;

export type PlanOverdueInput = {
  eligibility?: string | null;
  executionStatus?: string | null;
  expectedDate?: string | null;
  asoRecordId?: string | null;
  performedDate?: string | null;
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function parsePlanDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Item vencido: elegível, sem realização/justificativa/dispensa,
 * data prevista anterior a hoje.
 */
export function isPlanOverdue(
  plan: PlanOverdueInput,
  today: Date = startOfToday(),
): boolean {
  const elig = String(plan.eligibility || "").toUpperCase();
  const exec = String(plan.executionStatus || "").toUpperCase();

  if (elig !== "ELEGIVEL" && elig !== "") return false;
  if (CLOSED_EXECUTION.has(exec)) return false;
  if (plan.asoRecordId || plan.performedDate) return false;

  const expected = parsePlanDate(plan.expectedDate);
  if (!expected) return false;
  return expected < today;
}

/** Dias até o previsto (negativo = atrasado). */
export function daysUntilExpected(
  expectedDate: string | null | undefined,
  today: Date = startOfToday(),
): number | null {
  const expected = parsePlanDate(expectedDate);
  if (!expected) return null;
  return Math.round((expected.getTime() - today.getTime()) / 86400000);
}

export function isDueWithinDays(
  plan: PlanOverdueInput,
  days: number,
  today: Date = startOfToday(),
): boolean {
  const elig = String(plan.eligibility || "").toUpperCase();
  const exec = String(plan.executionStatus || "").toUpperCase();
  if (elig !== "ELEGIVEL" && elig !== "") return false;
  if (CLOSED_EXECUTION.has(exec)) return false;
  if (plan.asoRecordId || plan.performedDate) return false;
  const diff = daysUntilExpected(plan.expectedDate, today);
  if (diff == null) return false;
  return diff >= 0 && diff <= days;
}

/** Status de execução efetivo para exibição/métricas (deriva VENCIDO pela data). */
export function effectiveExecutionStatus(
  plan: PlanOverdueInput,
  today: Date = startOfToday(),
): ExecutionStatus | string {
  const exec = String(plan.executionStatus || "PREVISTO").toUpperCase();
  if (CLOSED_EXECUTION.has(exec)) return exec;
  if (isPlanOverdue(plan, today)) return "VENCIDO";
  return exec;
}

export function canRegisterRealization(plan: PlanOverdueInput): boolean {
  const exec = String(plan.executionStatus || "").toUpperCase();
  if (plan.asoRecordId || plan.performedDate || exec === "REALIZADO") {
    return false;
  }
  return (
    exec === "PREVISTO" ||
    exec === "AGENDADO" ||
    exec === "VENCIDO" ||
    exec === "REPROGRAMADO" ||
    exec === "NAO_REALIZADO" ||
    isPlanOverdue(plan)
  );
}

/**
 * Ainda precisa ser feito na competência (independente do dia do mês).
 * Saúde ocupacional controla pelo mês, não por “vence em X dias”.
 */
export function isOpenWorkload(plan: PlanOverdueInput): boolean {
  const elig = String(plan.eligibility || "").toUpperCase();
  const exec = String(plan.executionStatus || "").toUpperCase();
  if (elig !== "ELEGIVEL" && elig !== "") return false;
  if (CLOSED_EXECUTION.has(exec)) return false;
  if (plan.asoRecordId || plan.performedDate) return false;
  return true;
}

export function reasonExcludesDenominator(reason: string): boolean {
  const r = reason.trim().toUpperCase();
  if (NON_EXCLUSION_REASONS.has(r)) return false;
  return DENOMINATOR_EXCLUSION_REASONS.has(r);
}

export function resolveJustificationEligibility(
  reason: string,
): { eligibility: Eligibility; executionStatus: ExecutionStatus } {
  if (reasonExcludesDenominator(reason)) {
    return { eligibility: "JUSTIFICADO", executionStatus: "JUSTIFICADO" };
  }
  // Recusa/falta/outro: permanece no denominador
  return { eligibility: "ELEGIVEL", executionStatus: "JUSTIFICADO" };
}

export function humanizeImportBatchStatus(status: string | null | undefined): string {
  switch (String(status || "").toUpperCase()) {
    case "RUNNING":
      return "Em andamento";
    case "COMPLETED":
      return "Concluída";
    case "COMPLETED_WITH_ERRORS":
      return "Concluída com erros";
    case "FAILED":
      return "Falhou";
    case "CANCELLED":
    case "CANCELED":
      return "Cancelada";
    default:
      return status ? String(status) : "—";
  }
}

/** Lote RUNNING há mais de N minutos → possivelmente interrompido. */
export const STALE_SYNC_MINUTES = 30;

export function isSyncPossiblyStale(
  createdAt: Date | string | null | undefined,
  status: string | null | undefined,
  limitMinutes = STALE_SYNC_MINUTES,
): boolean {
  if (String(status || "").toUpperCase() !== "RUNNING") return false;
  if (!createdAt) return false;
  const start = new Date(createdAt).getTime();
  if (Number.isNaN(start)) return false;
  return Date.now() - start > limitMinutes * 60_000;
}
