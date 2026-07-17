/** Constantes e helpers de Material Biológico (exposições + follow-ups 30/60/90). */

export const BIO_STATUSES = [
  { value: "ALL", label: "Todos" },
  { value: "EM_ACOMPANHAMENTO", label: "Em acompanhamento" },
  { value: "CONCLUIDO", label: "Concluído" },
] as const;

export const BIO_FOLLOWUP_OFFSETS = [30, 60, 90] as const;

/** Tipos comuns da planilha / prática — livre também aceita texto. */
export const BIO_EXPOSURE_TYPES = [
  "Percutâneo",
  "Mucosas",
  "Pele não intacta",
  "Mordedura",
  "Outro",
] as const;

export type BioFollowupStatus = "PENDENTE" | "REALIZADO" | "ATRASADO";

export type BioFollowupView = {
  id: string;
  dayOffset: number;
  dueDate: string;
  performedAt: string | null;
  status: string;
  notes: string | null;
  /** Derivado: PENDENTE com dueDate < hoje */
  overdue: boolean;
  displayStatus: BioFollowupStatus;
};

export function bioStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "EM_ACOMPANHAMENTO":
      return "Em acomp.";
    case "CONCLUIDO":
      return "Concluído";
    default:
      return status?.trim() || "—";
  }
}

export function bioStatusTone(
  status: string | null | undefined,
): "ok" | "warn" | "info" | "muted" {
  switch (status) {
    case "EM_ACOMPANHAMENTO":
      return "warn";
    case "CONCLUIDO":
      return "ok";
    default:
      return "muted";
  }
}

export function exposureCompactLabel(
  exposureType: string | null | undefined,
): string {
  const s = (exposureType ?? "").trim();
  if (!s) return "—";
  if (s.length <= 18) return s;
  return `${s.slice(0, 16)}…`;
}

export function resolveFollowupDisplay(
  status: string,
  dueDate: string,
  todayIso = new Date().toISOString().slice(0, 10),
): { overdue: boolean; displayStatus: BioFollowupStatus } {
  const st = (status ?? "").toUpperCase();
  if (st === "REALIZADO" || st === "CONCLUIDO" || st === "FEITO") {
    return { overdue: false, displayStatus: "REALIZADO" };
  }
  const due = String(dueDate).slice(0, 10);
  const overdue = Boolean(due && due < todayIso);
  return {
    overdue,
    displayStatus: overdue ? "ATRASADO" : "PENDENTE",
  };
}

export function followupTone(
  displayStatus: BioFollowupStatus,
): "ok" | "warn" | "danger" | "muted" {
  switch (displayStatus) {
    case "REALIZADO":
      return "ok";
    case "ATRASADO":
      return "danger";
    case "PENDENTE":
      return "warn";
    default:
      return "muted";
  }
}

export function followupLabel(displayStatus: BioFollowupStatus): string {
  switch (displayStatus) {
    case "REALIZADO":
      return "Ok";
    case "ATRASADO":
      return "Atrasado";
    case "PENDENTE":
      return "Pendente";
    default:
      return displayStatus;
  }
}

/** Resumo dos 3 follow-ups para a linha da tabela. */
export function summarizeFollowups(followups: BioFollowupView[]): {
  pendingCount: number;
  overdueCount: number;
  doneCount: number;
  nextDue: string | null;
  summaryLabel: string;
  summaryTone: "ok" | "warn" | "danger" | "muted";
} {
  const pending = followups.filter((f) => f.displayStatus !== "REALIZADO");
  const overdue = followups.filter((f) => f.displayStatus === "ATRASADO");
  const done = followups.filter((f) => f.displayStatus === "REALIZADO");
  const next = pending
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  if (followups.length === 0) {
    return {
      pendingCount: 0,
      overdueCount: 0,
      doneCount: 0,
      nextDue: null,
      summaryLabel: "Sem FU",
      summaryTone: "muted",
    };
  }
  if (overdue.length > 0) {
    return {
      pendingCount: pending.length,
      overdueCount: overdue.length,
      doneCount: done.length,
      nextDue: next?.dueDate ?? null,
      summaryLabel: `${overdue.length} atras.`,
      summaryTone: "danger",
    };
  }
  if (pending.length > 0) {
    return {
      pendingCount: pending.length,
      overdueCount: 0,
      doneCount: done.length,
      nextDue: next?.dueDate ?? null,
      summaryLabel: `${done.length}/3`,
      summaryTone: "warn",
    };
  }
  return {
    pendingCount: 0,
    overdueCount: 0,
    doneCount: done.length,
    nextDue: null,
    summaryLabel: "3/3",
    summaryTone: "ok",
  };
}

export function buildBiologicalUrl(
  base: string,
  current: Record<string, string | number | undefined>,
  patch: Record<string, string | number | undefined | null>,
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...patch };
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (!s || s === "ALL") continue;
    params.set(k, s);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
