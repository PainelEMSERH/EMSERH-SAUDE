/**
 * Domínio ASO — tipos, enums e constantes.
 * Regra de aderência operacional:
 *   realizados válidos ÷ previstos elegíveis × 100
 * Consolidado ponderado (nunca média simples de percentuais).
 */

export const ASO_TYPES = [
  "PERIODICO",
  "ADMISSIONAL",
  "DEMISSIONAL",
  "RETORNO_TRABALHO",
  "MUDANCA_RISCO",
] as const;

export type AsoType = (typeof ASO_TYPES)[number];

export const ASO_TYPE_TABS = [
  { value: "ALL", label: "Visão geral" },
  { value: "PERIODICO", label: "Periódico" },
  { value: "ADMISSIONAL", label: "Admissional" },
  { value: "DEMISSIONAL", label: "Demissional" },
  { value: "RETORNO_TRABALHO", label: "Retorno ao trabalho" },
  { value: "MUDANCA_RISCO", label: "Mudança de riscos" },
] as const;

export const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export type ExecutionStatus =
  | "PREVISTO"
  | "AGENDADO"
  | "REALIZADO"
  | "NAO_REALIZADO"
  | "VENCIDO"
  | "REPROGRAMADO"
  | "JUSTIFICADO"
  | "DISPENSADO";

export type AlterdataReconcileStatus =
  | "NAO_APLICAVEL"
  | "AGUARDANDO_SINCRONIZACAO"
  | "CONFIRMADO"
  | "PENDENTE_ATUALIZACAO"
  | "DIVERGENCIA_DATA"
  | "ATUALIZADO_SEM_REGISTRO"
  | "SEM_HISTORICO";

export type Eligibility = "ELEGIVEL" | "JUSTIFICADO" | "NAO_ELEGIVEL";

export type CompetenceStatus = "ABERTA" | "EM_CONFERENCIA" | "FECHADA";

export const REALIZED_EXECUTION = new Set<ExecutionStatus>(["REALIZADO"]);

export const JUSTIFIED_ELIGIBILITY = new Set<Eligibility>([
  "JUSTIFICADO",
  "NAO_ELEGIVEL",
]);

/** Documentação da fórmula (exibida na UI / exportação). */
export const ASO_ADHERENCE_RULE = {
  code: "ASO_ADERENCIA",
  formula: "realizados_validos / previstos_elegiveis * 100",
  note:
    "Regra operacional inicial. A planilha institucional sugeria previstos÷realizados; o sistema usa realizados÷elegíveis (não invertido). Status: PENDENTE_VALIDACAO institucional.",
  consolidated: "soma(realizados regionais) / soma(elegíveis regionais) * 100",
} as const;
