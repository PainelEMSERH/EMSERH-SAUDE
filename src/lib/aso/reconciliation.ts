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
 * Concilia realização interna com histórico de próximo ASO do Alterdata.
 * Nunca marca CONFIRMADO só porque a data atual está no futuro.
 */
export function reconcileAlterdataStatus(
  input: ReconciliationInput,
): AlterdataReconcileStatus {
  const snaps = [...input.snapshots].sort(
    (a, b) => toTime(a.syncedAt) - toTime(b.syncedAt),
  );
  const performed = parseDay(input.performedDate);
  const periodicity = input.periodicityMonths && input.periodicityMonths > 0
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

  const after = snaps.filter((s) => toTime(s.syncedAt) > performed.getTime());
  if (!after.length) {
    return "AGUARDANDO_SINCRONIZACAO";
  }

  const before = snaps.filter((s) => toTime(s.syncedAt) <= performed.getTime());
  const baseline =
    before.length > 0
      ? before[before.length - 1]
      : snaps.length >= 2
        ? snaps[snaps.length - 2]
        : snaps[0];

  if (!baseline || snaps.length < 2) {
    // Só um snapshot após realização → sem baseline confiável
    if (before.length === 0 && snaps.length === 1) return "SEM_HISTORICO";
  }

  const baselineDate = parseDay(baseline?.nextAsoDate ?? null);
  const latest = after[after.length - 1];
  const latestDate = parseDay(latest.nextAsoDate);

  if (!baselineDate || !latestDate) {
    return "SEM_HISTORICO";
  }

  if (latestDate.getTime() <= baselineDate.getTime()) {
    return "PENDENTE_ATUALIZACAO";
  }

  if (latestDate.getTime() <= performed.getTime()) {
    return "DIVERGENCIA_DATA";
  }

  const expected = addRealMonths(performed, periodicity);
  if (daysBetween(expected, latestDate) > tolerance) {
    return "DIVERGENCIA_DATA";
  }

  return "CONFIRMADO";
}
