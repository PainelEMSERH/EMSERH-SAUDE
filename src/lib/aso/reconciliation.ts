import { addRealMonths } from "@/lib/dates";
import type { AlterdataReconcileStatus } from "./constants";

export type SnapshotPoint = {
  nextAsoDate: string | null;
  syncedAt: Date | string;
};

export type ReconciliationInput = {
  /** Realização interna (ISO date yyyy-mm-dd). */
  performedDate: string | null;
  /** Periodicidade em meses (default 12). */
  periodicityMonths?: number | null;
  /**
   * Snapshots ordenados do mais antigo ao mais recente
   * (ou qualquer ordem — a função ordena por syncedAt).
   */
  snapshots: SnapshotPoint[];
  /** Tolerância em dias para ciclo esperado (default 45). */
  cycleToleranceDays?: number;
};

function toTime(v: Date | string): number {
  return new Date(v).getTime();
}

function parseDay(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(
    Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

/**
 * Concilia realização interna com o espelho Alterdata.
 *
 * Com realização:
 * - sem sync depois da data → AGUARDANDO
 * - com próximo ASO coerente (realização + periodicidade) → CONFIRMADO
 * - sem avançar o ciclo → PENDENTE
 * - data incoerente → DIVERGENCIA
 *
 * Sem realização: só detecta avanço no espelho (ATUALIZADO_SEM_REGISTRO).
 */
export function reconcileAlterdataStatus(
  input: ReconciliationInput,
): AlterdataReconcileStatus {
  const snaps = [...input.snapshots].sort(
    (a, b) => toTime(a.syncedAt) - toTime(b.syncedAt),
  );
  const performed = parseDay(input.performedDate);
  const periodicity =
    input.periodicityMonths && input.periodicityMonths > 0
      ? input.periodicityMonths
      : 12;
  const tolerance = input.cycleToleranceDays ?? 45;

  if (!performed) {
    if (snaps.length < 2) return "SEM_HISTORICO";
    const prev = snaps[snaps.length - 2];
    const last = snaps[snaps.length - 1];
    const prevDate = parseDay(prev.nextAsoDate);
    const lastDate = parseDay(last.nextAsoDate);
    if (!prevDate || !lastDate) return "SEM_HISTORICO";
    if (lastDate.getTime() > prevDate.getTime()) {
      return "ATUALIZADO_SEM_REGISTRO";
    }
    return "SEM_HISTORICO";
  }

  if (!snaps.length) {
    return "AGUARDANDO_SINCRONIZACAO";
  }

  const after = snaps.filter((s) => toTime(s.syncedAt) > performed.getTime());
  if (!after.length) {
    return "AGUARDANDO_SINCRONIZACAO";
  }

  const latest = after[after.length - 1];
  const latestDate = parseDay(latest.nextAsoDate);
  if (!latestDate) return "SEM_HISTORICO";

  // Baseline só conta se existia espelho ANTES da realização.
  // Não usar outro snapshot posterior como baseline (gera falso "pendente"/"sem histórico").
  const before = snaps.filter((s) => toTime(s.syncedAt) <= performed.getTime());
  if (before.length > 0) {
    const baselineDate = parseDay(before[before.length - 1].nextAsoDate);
    if (baselineDate && latestDate.getTime() <= baselineDate.getTime()) {
      return "PENDENTE_ATUALIZACAO";
    }
  }

  if (latestDate.getTime() <= performed.getTime()) {
    return "PENDENTE_ATUALIZACAO";
  }

  const expected = addRealMonths(performed, periodicity);
  if (daysBetween(expected, latestDate) > tolerance) {
    return "DIVERGENCIA_DATA";
  }

  return "CONFIRMADO";
}
