/** Tipos reais do espelho Alterdata (leave_type persistido). */

export const LEAVE_TYPES = [
  {
    value: "01 - Afast. por motivo de doen",
    label: "01 — Afast. por motivo de doença",
    shortLabel: "Afast. doença",
    code: "01",
  },
  {
    value: "03 - Licença Maternidade",
    label: "03 — Licença maternidade",
    shortLabel: "Licença maternidade",
    code: "03",
  },
  {
    value: "10 - Atestados",
    label: "10 — Atestados",
    shortLabel: "Atestados",
    code: "10",
  },
  {
    value: "11 - Prorrog. Maternidade Lei",
    label: "11 — Prorrogação maternidade",
    shortLabel: "Prorrog. maternidade",
    code: "11",
  },
] as const;

/** Abas operacionais — atestados ficam isolados para não poluir o acompanhamento. */
export const LEAVE_TABS = [
  {
    value: "doenca",
    label: "Afast. doença",
    hint: "INSS / motivo de doença — acompanhamento prioritário",
    types: ["01 - Afast. por motivo de doen"] as string[],
  },
  {
    value: "licencas",
    label: "Licenças",
    hint: "Maternidade e prorrogação",
    types: [
      "03 - Licença Maternidade",
      "11 - Prorrog. Maternidade Lei",
    ] as string[],
  },
  {
    value: "atestados",
    label: "Atestados",
    hint: "Volume alto — separado do acompanhamento clínico",
    types: ["10 - Atestados"] as string[],
  },
  {
    value: "ALL",
    label: "Todos",
    hint: "Visão completa",
    types: null as string[] | null,
  },
] as const;

export type LeaveTabValue = (typeof LEAVE_TABS)[number]["value"];

/** Aba padrão: o que a enfermagem precisa acompanhar de perto. */
export const DEFAULT_LEAVE_TAB: LeaveTabValue = "doenca";

export const LEAVE_STATUSES = [
  { value: "ATIVO", label: "Ativo" },
  { value: "ENCERRADO", label: "Encerrado" },
] as const;

export function resolveLeaveTab(raw?: string | null): LeaveTabValue {
  const v = (raw ?? "").trim();
  if (LEAVE_TABS.some((t) => t.value === v)) return v as LeaveTabValue;
  return DEFAULT_LEAVE_TAB;
}

export function leaveTypesForTab(tab: LeaveTabValue): string[] | null {
  const found = LEAVE_TABS.find((t) => t.value === tab);
  return found?.types ?? null;
}

export function leaveTypeLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  const found = LEAVE_TYPES.find((t) => t.value === raw);
  if (found) return found.shortLabel;
  return raw;
}

export function leaveRequiresReturnAso(leaveType: string): boolean {
  const t = leaveType.toUpperCase();
  // 01 = afastamento por doença (INSS); também códigos legados
  if (t.startsWith("01") || t.includes("AFAST. POR MOTIVO")) return true;
  return ["INSS", "ACIDENTE", "AFASTAMENTO"].some((k) => t.includes(k));
}

export function buildLeavesUrl(
  base: string,
  current: Record<string, string | number | undefined>,
  patch: Record<string, string | number | undefined | null>,
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...patch };
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (!s || s === "ALL") {
      // tab "Todos" precisa aparecer na URL para não cair no default "doenca"
      if (k === "group" && s === "ALL") params.set(k, "ALL");
      continue;
    }
    params.set(k, s);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
