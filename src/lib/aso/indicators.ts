import {
  ASO_ADHERENCE_RULE,
  JUSTIFIED_ELIGIBILITY,
  REALIZED_EXECUTION,
  type Eligibility,
  type ExecutionStatus,
} from "./constants";
import { effectiveExecutionStatus, isPlanOverdue } from "./execution";

export type PlanMetricRow = {
  eligibility: Eligibility | string;
  executionStatus: ExecutionStatus | string;
  alterdataStatus?: string | null;
  expectedDate?: string | null;
  asoRecordId?: string | null;
  performedDate?: string | null;
  justificationReason?: string | null;
  functionalStatusSnapshot?: string | null;
};

export type CompetenceMetrics = {
  previstosBrutos: number;
  justificados: number;
  afastados: number;
  ferias: number;
  demitidos: number;
  outrosJustificados: number;
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
  metaDefined: boolean;
};

export function computeCompetenceMetrics(
  rows: PlanMetricRow[],
  metaPercent: number | null = null,
  today: Date = new Date(),
): CompetenceMetrics {
  const previstosBrutos = rows.length;
  let justificados = 0;
  let afastados = 0;
  let ferias = 0;
  let demitidos = 0;
  let outrosJustificados = 0;
  let previstosElegiveis = 0;
  let realizados = 0;
  let confirmadosAlterdata = 0;
  let pendentesAlterdata = 0;
  let naoRealizados = 0;
  let vencidos = 0;

  const day = new Date(today);
  day.setHours(0, 0, 0, 0);

  for (const r of rows) {
    const elig = String(r.eligibility || "").toUpperCase();
    const exec = String(r.executionStatus || "").toUpperCase();
    const alt = String(r.alterdataStatus || "").toUpperCase();
    const reason = String(r.justificationReason || "").toUpperCase();
    const functional = String(r.functionalStatusSnapshot || "").toUpperCase();
    const leaveTag = reason || functional;
    if (leaveTag === "AFASTADO") afastados += 1;
    if (leaveTag === "FERIAS") ferias += 1;

    const effective = effectiveExecutionStatus(
      {
        eligibility: elig,
        executionStatus: exec,
        expectedDate: r.expectedDate,
        asoRecordId: r.asoRecordId,
        performedDate: r.performedDate,
      },
      day,
    );

    // Realizado conta sempre — inclusive demissional com elegibilidade JUSTIFICADO residual.
    if (REALIZED_EXECUTION.has(exec as ExecutionStatus) || r.asoRecordId || r.performedDate) {
      previstosElegiveis += 1;
      realizados += 1;
      if (alt === "CONFIRMADO") confirmadosAlterdata += 1;
      if (
        alt === "PENDENTE_ATUALIZACAO" ||
        alt === "AGUARDANDO_SINCRONIZACAO"
      ) {
        pendentesAlterdata += 1;
      }
      continue;
    }

    if (
      JUSTIFIED_ELIGIBILITY.has(elig as Eligibility) ||
      exec === "JUSTIFICADO" ||
      exec === "DISPENSADO"
    ) {
      // JUSTIFICADO com elegibilidade ELEGIVEL (recusa/falta) permanece no denominador
      if (elig === "ELEGIVEL" && exec === "JUSTIFICADO") {
        previstosElegiveis += 1;
        naoRealizados += 1;
        if (isPlanOverdue(r, day) || effective === "VENCIDO") vencidos += 1;
        continue;
      }
      justificados += 1;
      if (leaveTag === "DEMITIDO") demitidos += 1;
      else if (leaveTag === "AFASTADO" || leaveTag === "FERIAS") {
        // já contabilizados em afastados/ferias
      } else {
        outrosJustificados += 1;
      }
      continue;
    }

    previstosElegiveis += 1;

    if (effective === "VENCIDO" || isPlanOverdue(r, day)) {
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

  const metaDefined = metaPercent != null;
  let faltamParaMeta: number | null = null;
  if (metaDefined && denominador > 0) {
    const needed = Math.ceil((metaPercent! / 100) * denominador);
    faltamParaMeta = Math.max(0, needed - realizados);
  }

  return {
    previstosBrutos,
    justificados,
    afastados,
    ferias,
    demitidos,
    outrosJustificados,
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
    metaDefined,
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
}): "ok" | "near" | "below" | "empty" | "future" | "neutral" {
  if (input.isFuture) return "future";
  if (!input.hasDenominator || input.percent == null) return "empty";
  // Sem meta cadastrada: tom neutro — nunca usar 80% silencioso
  if (input.metaPercent == null) return "neutral";
  const meta = input.metaPercent;
  if (input.percent >= meta) return "ok";
  if (input.percent >= meta - 10) return "near";
  return "below";
}
