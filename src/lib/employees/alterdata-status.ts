import { normalizeText } from "@/lib/validation";

/**
 * Mapeia situação funcional a partir dos campos reais do espelho Alterdata.
 * Não inventa status sem evidência.
 */
export function mapAlterdataFunctionalStatus(input: {
  dismissalRaw?: string;
  statusAso?: string;
  afastamentoRaw?: string;
  statusFerias?: string;
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
