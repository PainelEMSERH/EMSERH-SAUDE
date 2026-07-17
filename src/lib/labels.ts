/**
 * Humaniza enums/status técnicos para exibição.
 * Não altera valores persistidos no banco.
 */

const LABELS: Record<string, string> = {
  // Situação funcional
  ATIVO: "Ativo",
  AFASTADO: "Afastado",
  DEMITIDO: "Demitido",
  FERIAS: "Férias",
  LICENCA: "Licença",

  // Genéricos
  NAO_INFORMADA: "Não informada",
  NAO_INFORMADO: "Não informado",
  NAO_APLICAVEL: "Não aplicável",

  // ASO tipos
  ADMISSIONAL: "Admissional",
  PERIODICO: "Periódico",
  RETORNO_TRABALHO: "Retorno ao trabalho",
  MUDANCA_RISCO: "Mudança de risco",
  DEMISSIONAL: "Demissional",
  VENCIDO: "Vencido",
  A_VENCER: "A vencer",
  EM_DIA: "Em dia",

  // Execução ASO
  PREVISTO: "Previsto",
  AGENDADO: "Agendado",
  REALIZADO: "Realizado",
  NAO_REALIZADO: "Não realizado",
  REPROGRAMADO: "Reprogramado",
  JUSTIFICADO: "Justificado",
  DISPENSADO: "Dispensado com justificativa",

  // Conciliação Alterdata
  AGUARDANDO_SINCRONIZACAO: "Aguardando sincronização",
  CONFIRMADO: "Confirmado",
  PENDENTE_ATUALIZACAO: "Pendente de atualização",
  DIVERGENCIA_DATA: "Divergência de data",
  ATUALIZADO_SEM_REGISTRO: "Atualizado sem registro interno",
  SEM_HISTORICO: "Sem histórico suficiente para confirmar",

  // Elegibilidade
  ELEGIVEL: "Elegível",
  NAO_ELEGIVEL: "Não elegível",

  // Competência
  ABERTA: "Aberta",
  EM_CONFERENCIA: "Em conferência",
  FECHADA: "Fechada",

  // Lotes de importação / sync
  RUNNING: "Em andamento",
  COMPLETED: "Concluída",
  COMPLETED_WITH_ERRORS: "Concluída com erros",
  FAILED: "Falhou",
  CANCELLED: "Cancelada",
  CANCELED: "Cancelada",

  // Justificativas
  RECUSA: "Recusa",
  FALTA: "Falta",
  DISPENSA: "Dispensa",
  REPROGRAMACAO: "Reprogramação",
  TRANSFERIDO: "Transferido",
  OUTRO: "Outro",
  AFASTADO_JUSTIFICATIVA: "Afastado",

  // Origens
  ALTERDATA_NEXT_ASO: "Próximo ASO Alterdata",
  RECOMPUTED_FROM_LAST_ASO: "Recalculado pelo atestado",
  RECOMPUTED_FROM_ADMISSION: "Recalculado pela admissão",
  ADMISSION: "Admissão",
  DISMISSAL: "Desligamento",
  RETURN: "Retorno ao trabalho",
  MANUAL_RISK_CHANGE: "Mudança de risco (manual)",
  IMPORT: "Importação",
  MIGRATION: "Migração",
  MANUAL: "Manual",
  SYNC: "Sincronização",

  // Afastamento / status genéricos
  ENCERRADO: "Encerrado",
  PENDENTE: "Pendente",
  CANCELADO: "Cancelado",
  PRESENTE: "Presente",
  AUSENTE: "Ausente",
  IMPORTADO: "Importado",
  EM_ACOMPANHAMENTO: "Em acompanhamento",
  CONCLUIDO: "Concluído",
};

export function humanizeLabel(
  value: string | null | undefined,
  fallback = "—",
): string {
  if (value == null || String(value).trim() === "") return fallback;
  const raw = String(value).trim();
  const key = raw.toUpperCase().replace(/\s+/g, "_");
  if (LABELS[key]) return LABELS[key];
  if (LABELS[raw]) return LABELS[raw];
  // Já humanizado ou texto livre
  if (/[a-záàâãéêíóôõúç]/i.test(raw) && raw !== key) return raw;
  return raw
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export type StatusTone = "ok" | "warn" | "danger" | "muted" | "info";

export function toneForFunctionalStatus(
  status: string | null | undefined,
): StatusTone {
  switch ((status ?? "").toUpperCase()) {
    case "ATIVO":
      return "ok";
    case "AFASTADO":
      return "warn";
    case "DEMITIDO":
      return "danger";
    case "FERIAS":
      return "info";
    default:
      return "muted";
  }
}

export function toneForDeadlineStatus(
  status: string | null | undefined,
): StatusTone {
  switch ((status ?? "").toUpperCase()) {
    case "VENCIDO":
      return "danger";
    case "A_VENCER":
      return "warn";
    case "EM_DIA":
      return "ok";
    default:
      return "muted";
  }
}

export function initialsFromName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Exibe matrícula com no mínimo 5 dígitos (zeros à esquerda). */
export function formatRegistrationDisplay(
  registration: string | null | undefined,
): string {
  if (!registration) return "—";
  const raw = String(registration).trim();
  if (!raw) return "—";
  if (/^\d+$/.test(raw) && raw.length < 5) {
    return raw.padStart(5, "0");
  }
  return raw;
}
