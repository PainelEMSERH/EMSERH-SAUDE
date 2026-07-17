import {
  ASO_ADHERENCE_RULE,
  JUSTIFIED_ELIGIBILITY,
  REALIZED_EXECUTION,
  type Eligibility,
  type ExecutionStatus,
} from "./constants";

export type PlanMetricRow = {
  eligibility: Eligibility | string;
  executionStatus: ExecutionStatus | string;
  alterdataStatus?: string | null;
};

export type CompetenceMetrics = {
  previstosBrutos: number;
  justificados: number;
  previstosElegiveis: number;
  realizados: number;
  confirmadosAlterdata: number;
  pendentesAlterdata: number;
  naoRealizados: number;
  vencidos: number;
  aderenciaPercent: number | null;
  excedente: number;
  metaPercent: number | null;
  faltamParaMeta: number | null;
  numerador: number;
  denominador: number;
  rule: typeof ASO_ADHERENCE_RULE;
};

export function computeCompetenceMetrics(
  rows: PlanMetricRow[],
  metaPercent: number | null = null,
): CompetenceMetrics {
  const previstosBrutos = rows.length;
  let justificados = 0;
  let previstosElegiveis = 0;
  let realizados = 0;
  let confirmadosAlterdata = 0;
  let pendentesAlterdata = 0;
  let naoRealizados = 0;
  let vencidos = 0;

  for (const r of rows) {
    const elig = String(r.eligibility || "").toUpperCase();
    const exec = String(r.executionStatus || "").toUpperCase();
    const alt = String(r.alterdataStatus || "").toUpperCase();

    if (JUSTIFIED_ELIGIBILITY.has(elig as Eligibility) || exec === "JUSTIFICADO" || exec === "DISPENSADO") {
      justificados += 1;
      continue;
    }

    previstosElegiveis += 1;

    if (REALIZED_EXECUTION.has(exec as ExecutionStatus)) {
      realizados += 1;
      if (alt === "CONFIRMADO") confirmadosAlterdata += 1;
      if (
        alt === "PENDENTE_ATUALIZACAO" ||
        alt === "AGUARDANDO_SINCRONIZACAO"
      ) {
        pendentesAlterdata += 1;
      }
    } else if (exec === "VENCIDO") {
      vencidos += 1;
      naoRealizados += 1;
    } else {
      naoRealizados += 1;
    }
  }

  const numerador = realizados;
  const denominador = previstosElegiveis;
  let aderenciaPercent: number | null = null;
  let excedente = 0;
  if (denominador <= 0) {
    aderenciaPercent = null;
  } else {
    const raw = (numerador / denominador) * 100;
    if (raw > 100) {
      aderenciaPercent = 100;
      excedente = numerador - denominador;
    } else {
      aderenciaPercent = Math.round(raw * 10) / 10;
    }
  }

  let faltamParaMeta: number | null = null;
  if (metaPercent != null && denominador > 0) {
    const needed = Math.ceil((metaPercent / 100) * denominador);
    faltamParaMeta = Math.max(0, needed - realizados);
  }

  return {
    previstosBrutos,
    justificados,
    previstosElegiveis,
    realizados,
    confirmadosAlterdata,
    pendentesAlterdata,
    naoRealizados,
    vencidos,
    aderenciaPercent,
    excedente,
    metaPercent,
    faltamParaMeta,
    numerador,
    denominador,
    rule: ASO_ADHERENCE_RULE,
  };
}

/**
 * Consolidado ponderado: soma realizados / soma elegíveis.
 * Nunca média aritmética dos percentuais.
 */
export function consolidateWeighted(
  parts: Array<{ realizados: number; previstosElegiveis: number }>,
): { percent: number | null; numerador: number; denominador: number } {
  const numerador = parts.reduce((s, p) => s + p.realizados, 0);
  const denominador = parts.reduce((s, p) => s + p.previstosElegiveis, 0);
  if (denominador <= 0) return { percent: null, numerador, denominador };
  const raw = (numerador / denominador) * 100;
  return {
    percent: Math.min(100, Math.round(raw * 10) / 10),
    numerador,
    denominador,
  };
}

export function matrixCellTone(input: {
  percent: number | null;
  metaPercent: number | null;
  hasDenominator: boolean;
  isFuture: boolean;
}): "ok" | "near" | "below" | "empty" | "future" {
  if (input.isFuture) return "future";
  if (!input.hasDenominator || input.percent == null) return "empty";
  const meta = input.metaPercent ?? 80;
  if (input.percent >= meta) return "ok";
  if (input.percent >= meta - 10) return "near";
  return "below";
}
