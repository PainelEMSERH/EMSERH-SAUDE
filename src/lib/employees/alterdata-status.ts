import { normalizeText } from "@/lib/validation";
import { parseSheetDate } from "@/lib/dates";

/**
 * True se o colaborador está em afastamento na data de referência
 * (início <= hoje e (sem fim ou fim >= hoje)).
 */
export function isActiveLeavePeriod(
  startRaw?: string | number | null,
  endRaw?: string | number | null,
  todayIso: string = new Date().toISOString().slice(0, 10),
): boolean {
  const start = parseSheetDate(startRaw ?? null);
  if (!start) return false;
  if (start > todayIso) return false;
  const end = parseSheetDate(endRaw ?? null);
  if (!end) return true;
  return end >= todayIso;
}

/**
 * Mapeia situação funcional a partir dos campos reais do espelho Alterdata.
 * Não inventa status sem evidência.
 *
 * Planilha oficial traz "Início Afastamento" / "Fim Afastamento" (serial Excel).
 * Sem essas datas, cai no texto de Status_ASO / campos de afastamento.
 */
export function mapAlterdataFunctionalStatus(input: {
  dismissalRaw?: string;
  statusAso?: string;
  afastamentoRaw?: string;
  statusFerias?: string;
  leaveStartRaw?: string | number | null;
  leaveEndRaw?: string | number | null;
  todayIso?: string;
}): string {
  const demissao = (input.dismissalRaw || "").trim();
  if (demissao) return "DEMITIDO";

  const statusAso = normalizeText(input.statusAso || "");
  if (statusAso.includes("DEMIT")) return "DEMITIDO";

  const ferias = normalizeText(
    `${input.statusFerias || ""} ${input.statusAso || ""}`,
  );
  if (
    ferias.includes("FERIAS") ||
    ferias.includes("EM FERIAS") ||
    ferias === "FERIAS"
  ) {
    return "FERIAS";
  }

  if (
    isActiveLeavePeriod(
      input.leaveStartRaw,
      input.leaveEndRaw,
      input.todayIso ?? new Date().toISOString().slice(0, 10),
    )
  ) {
    return "AFASTADO";
  }

  const afast = normalizeText(
    `${input.afastamentoRaw || ""} ${input.statusAso || ""}`,
  );
  if (
    afast.includes("AFAST") ||
    afast.includes("LICENCA") ||
    afast.includes("INSS")
  ) {
    return "AFASTADO";
  }

  // Presente no espelho sem demissão/afastamento/férias → ativo.
  // Status_ASO não define sozinho a situação funcional.
  return "ATIVO";
}

export function mapAlterdataSex(raw: string): string | null {
  const n = normalizeText(raw);
  if (!n) return null;
  if (n.startsWith("F") || n === "FEMININO") return "F";
  if (n.startsWith("M") || n === "MASCULINO") return "M";
  return raw.trim().slice(0, 20) || null;
}
