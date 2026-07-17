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
  ATESTADO: "Atestado",
  INSS: "INSS",
  LICENCA_MATERNIDADE: "Licença-maternidade",
  LICENCA_PATERNIDADE: "Licença-paternidade",
  ACIDENTE: "Acidente",
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

/**
 * Abrevia nomes longos de unidade só na UI (maiúsculas, padrão do sistema).
 * Ex.: "AGENCIA TRANSFUSIONAL BACABAL" → "AG. TRANSF. BACABAL"
 */
export function formatUnitDisplayName(
  value: string | null | undefined,
  fallback = "—",
): string {
  if (value == null || String(value).trim() === "") return fallback;
  const raw = String(value).trim();
  const match = raw.match(
    /^(ag[eê]ncia)\s+transfusional(?:\s+de)?\s+(.+)$/i,
  );
  if (match?.[2]) {
    const place = match[2]
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleUpperCase("pt-BR");
    return `AG. TRANSF. ${place}`;
  }
  return humanizeLabel(raw, fallback);
}

/** Preposições/artigos que ficam minúsculos no meio do nome. */
const SECTOR_SMALL_WORDS = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "à",
  "às",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "ou",
  "para",
  "por",
]);

/** Siglas mantidas em maiúsculas na UI. */
const SECTOR_ACRONYMS = new Set([
  "CCIH",
  "CME",
  "INSS",
  "NSP",
  "SAME",
  "UCINCA",
  "UCINCO",
  "UTI",
  "UTIN",
  "UTINEO",
]);

/** Correções leves só para exibição (não altera o banco). */
const SECTOR_DISPLAY_FIXES: Array<[RegExp, string]> = [
  [/\bINTERNÇÃO\b/gi, "INTERNAÇÃO"],
  [/\bCLINICA\b/gi, "CLÍNICA"],
  [/\bCIRURGICA\b/gi, "CIRÚRGICA"],
  [/\bOBSERVACAO\b/gi, "OBSERVAÇÃO"],
  [/\bNUCLEO\b/gi, "NÚCLEO"],
  [/\bDIRECAO\b/gi, "DIREÇÃO"],
  [/\bCOORDENACAO\b/gi, "COORDENAÇÃO"],
  [/\bADMINISTRACAO\b/gi, "ADMINISTRAÇÃO"],
];

/**
 * Padroniza nome de setor na UI: title case em pt-BR, siglas e abreviações
 * estáveis (Adm., Coord.), sem o “CAPS LOCK” do espelho.
 */
export function formatSectorDisplayName(
  value: string | null | undefined,
  fallback = "—",
): string {
  if (value == null || String(value).trim() === "") return fallback;

  let raw = String(value).trim().replace(/\s+/g, " ");
  for (const [pattern, replacement] of SECTOR_DISPLAY_FIXES) {
    raw = raw.replace(pattern, replacement);
  }

  const parts = raw.split(/(\s+|\/|,|\s*[-–—]\s*)/);
  let wordIndex = 0;

  return parts
    .map((part) => {
      if (!part || /^\s+$/.test(part)) return part;
      if (/^[\/,]$/.test(part)) return part;
      if (/^\s*[-–—]\s*$/.test(part)) return " - ";

      const isFirst = wordIndex === 0;
      wordIndex += 1;

      const hasDot = part.endsWith(".");
      const core = hasDot ? part.slice(0, -1) : part;
      const upper = core.toLocaleUpperCase("pt-BR");
      const lower = core.toLocaleLowerCase("pt-BR");

      if (SECTOR_ACRONYMS.has(upper)) {
        return `${upper}${hasDot ? "." : ""}`;
      }

      // Abreviações curtas: ADM. / COORD. → Adm. / Coord.
      if (/^(adm|coord|nuc|set|dir)$/i.test(core)) {
        const short =
          lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
        return `${short}${hasDot || /^(adm|coord)$/i.test(core) ? "." : ""}`;
      }

      if (!isFirst && SECTOR_SMALL_WORDS.has(lower)) {
        return lower;
      }

      // Mantém números e tokens mistos (ex.: B, 3) sem forçar artefato
      if (/^\d+[ªº]?$/i.test(core) || /^[A-Z]$/i.test(core)) {
        return upper.length === 1 ? upper : core;
      }

      return (
        lower.charAt(0).toLocaleUpperCase("pt-BR") +
        lower.slice(1) +
        (hasDot ? "." : "")
      );
    })
    .join("")
    .replace(/\s+-\s+/g, " - ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*\/\s*/g, "/")
    .trim();
}

