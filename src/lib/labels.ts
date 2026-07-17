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

  // ASO
  ADMISSIONAL: "Admissional",
  PERIODICO: "Periódico",
  RETORNO_TRABALHO: "Retorno ao trabalho",
  MUDANCA_RISCO: "Mudança de risco",
  DEMISSIONAL: "Demissional",
  VENCIDO: "Vencido",
  A_VENCER: "A vencer",
  EM_DIA: "Em dia",

  // Afastamento / status genéricos
  ENCERRADO: "Encerrado",
  PENDENTE: "Pendente",
  CONFIRMADO: "Confirmado",
  CANCELADO: "Cancelado",
  PRESENTE: "Presente",
  AUSENTE: "Ausente",
  IMPORTADO: "Importado",
  EM_ACOMPANHAMENTO: "Em acompanhamento",
  CONCLUIDO: "Concluído",
  REALIZADO: "Realizado",
  AGENDADO: "Agendado",
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
