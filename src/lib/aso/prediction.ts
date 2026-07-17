/**
 * Resolução confiável da previsão de ASO periódico.
 * O espelho Alterdata é fonte importante, mas NÃO absoluta:
 * - Proximo_aso antes do atestado → inválido
 * - Proximo_aso antes de admissão+periodicidade → não é 1º periódico
 * - Admissional: atestado ≥ admissão evidencia realização
 */
import { addRealMonths } from "@/lib/dates";

export type PredictionInput = {
  admissionDate?: string | null;
  lastAsoDate?: string | null;
  alterdataNextDate?: string | null;
  periodicityMonths?: number | null;
};

export type TrustedPeriodicResult = {
  nextPeriodicDate: string | null;
  trust:
    | "ALTERDATA"
    | "RECOMPUTED_FROM_LAST"
    | "RECOMPUTED_FROM_ADMISSION"
    | "UNAVAILABLE";
  reason: string;
  /** Há atestado no Alterdata em data ≥ admissão (admissional evidenciado). */
  admissionAsoEvidence: boolean;
  periodicityMonths: number;
};

function parseDay(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function resolvePeriodicity(raw: number | null | undefined): number {
  if (raw && raw > 0 && raw <= 60) return raw;
  return 12;
}

/**
 * Evidência de que o ASO admissional já ocorreu no Alterdata.
 * lastAso na data da admissão ou depois.
 */
export function hasAdmissionAsoEvidence(
  admissionDate: string | null | undefined,
  lastAsoDate: string | null | undefined,
): boolean {
  const admission = parseDay(admissionDate);
  const last = parseDay(lastAsoDate);
  if (!admission || !last) return false;
  return last.getTime() >= admission.getTime();
}

/**
 * Decide a data confiável do próximo periódico.
 */
export function resolveTrustedPeriodicNext(
  input: PredictionInput,
): TrustedPeriodicResult {
  const periodicityMonths = resolvePeriodicity(input.periodicityMonths);
  const admission = parseDay(input.admissionDate);
  const last = parseDay(input.lastAsoDate);
  const next = parseDay(input.alterdataNextDate);
  const admissionAsoEvidence = hasAdmissionAsoEvidence(
    input.admissionDate,
    input.lastAsoDate,
  );

  const fromLast = last ? addRealMonths(last, periodicityMonths) : null;
  const fromAdmission = admission
    ? addRealMonths(admission, periodicityMonths)
    : null;

  // 1) Proximo_aso inconsistente com atestado (ex.: próximo em jan, atestado em fev)
  if (last && next && next.getTime() <= last.getTime()) {
    return {
      nextPeriodicDate: fromLast ? toIso(fromLast) : null,
      trust: "RECOMPUTED_FROM_LAST",
      reason:
        "Proximo_aso anterior ou igual ao atestado no Alterdata; recalculado por atestado + periodicidade.",
      admissionAsoEvidence,
      periodicityMonths,
    };
  }

  // 2) Ainda no primeiro ciclo após admissão: não agendar periódico antecipado
  if (admission && fromAdmission && next && next.getTime() < fromAdmission.getTime()) {
    if (fromLast && last && last.getTime() >= admission.getTime()) {
      return {
        nextPeriodicDate: toIso(fromLast),
        trust: "RECOMPUTED_FROM_LAST",
        reason:
          "Proximo_aso antes do primeiro ciclo (admissão + periodicidade); usando atestado + periodicidade.",
        admissionAsoEvidence,
        periodicityMonths,
      };
    }
    return {
      nextPeriodicDate: toIso(fromAdmission),
      trust: "RECOMPUTED_FROM_ADMISSION",
      reason:
        "Proximo_aso antes do primeiro ciclo; usando admissão + periodicidade (não há periódico no ano da admissão).",
      admissionAsoEvidence,
      periodicityMonths,
    };
  }

  // 3) Alterdata consistente
  if (next) {
    return {
      nextPeriodicDate: toIso(next),
      trust: "ALTERDATA",
      reason: "Proximo_aso consistente com admissão e atestado.",
      admissionAsoEvidence,
      periodicityMonths,
    };
  }

  // 4) Sem Proximo_aso — derivar
  if (fromLast) {
    return {
      nextPeriodicDate: toIso(fromLast),
      trust: "RECOMPUTED_FROM_LAST",
      reason: "Sem Proximo_aso; calculado por atestado + periodicidade.",
      admissionAsoEvidence,
      periodicityMonths,
    };
  }
  if (fromAdmission) {
    return {
      nextPeriodicDate: toIso(fromAdmission),
      trust: "RECOMPUTED_FROM_ADMISSION",
      reason: "Sem Proximo_aso/atestado; calculado por admissão + periodicidade.",
      admissionAsoEvidence,
      periodicityMonths,
    };
  }

  return {
    nextPeriodicDate: null,
    trust: "UNAVAILABLE",
    reason: "Sem admissão, atestado ou Proximo_aso para prever periódico.",
    admissionAsoEvidence,
    periodicityMonths,
  };
}
