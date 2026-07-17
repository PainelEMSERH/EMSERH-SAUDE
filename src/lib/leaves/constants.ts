/** Tipos e status de afastamento (valores persistidos). */

export const LEAVE_TYPES = [
  { value: "ATESTADO", label: "Atestado" },
  { value: "INSS", label: "INSS" },
  { value: "LICENCA_MATERNIDADE", label: "Licença-maternidade" },
  { value: "LICENCA_PATERNIDADE", label: "Licença-paternidade" },
  { value: "ACIDENTE", label: "Acidente" },
  { value: "OUTRO", label: "Outro" },
] as const;

export const LEAVE_STATUSES = [
  { value: "ATIVO", label: "Ativo" },
  { value: "ENCERRADO", label: "Encerrado" },
] as const;

export type LeaveTypeValue = (typeof LEAVE_TYPES)[number]["value"];

export function leaveRequiresReturnAso(leaveType: string): boolean {
  const t = leaveType.toUpperCase();
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
    if (!s || s === "ALL") continue;
    params.set(k, s);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
