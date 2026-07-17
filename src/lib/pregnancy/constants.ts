/** Constantes e helpers do módulo Gestantes. */

export const PREGNANCY_STATUSES = [
  { value: "ALL", label: "Todos" },
  { value: "EM_ACOMPANHAMENTO", label: "Em acompanhamento" },
  { value: "LICENCA", label: "Licença" },
  { value: "APTO", label: "Encerrado" },
] as const;

export const PREGNANCY_PROOF_TYPES = [
  "Ultrassonografia",
  "Exame laboratorial",
  "Atestado médico",
  "Declaração",
  "Outro",
] as const;

export function pregnancyStatusLabel(status: string | null | undefined): string {
  switch ((status ?? "").toUpperCase()) {
    case "EM_ACOMPANHAMENTO":
      return "Em acomp.";
    case "LICENCA":
      return "Licença";
    case "APTO":
      return "Encerrado";
    default:
      return status?.trim() || "—";
  }
}

export function pregnancyStatusTone(
  status: string | null | undefined,
): "ok" | "warn" | "info" | "muted" {
  switch ((status ?? "").toUpperCase()) {
    case "EM_ACOMPANHAMENTO":
      return "warn";
    case "LICENCA":
      return "info";
    case "APTO":
      return "ok";
    default:
      return "muted";
  }
}

export function hazardousLabel(row: {
  hazardousActivity: boolean | null;
  relocationDate: string | null;
}): { label: string; tone: "ok" | "danger" | "muted" | "warn" } {
  if (!row.hazardousActivity) {
    return { label: "Não", tone: "muted" };
  }
  if (row.relocationDate) {
    return { label: "Realocada", tone: "ok" };
  }
  return { label: "Sem realocação", tone: "danger" };
}

export function isInsalubreSemRealocacao(row: {
  hazardousActivity: boolean | null;
  relocationDate: string | null;
  status: string;
}): boolean {
  return (
    Boolean(row.hazardousActivity) &&
    !row.relocationDate &&
    (row.status ?? "").toUpperCase() === "EM_ACOMPANHAMENTO"
  );
}

export function buildPregnancyUrl(
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
