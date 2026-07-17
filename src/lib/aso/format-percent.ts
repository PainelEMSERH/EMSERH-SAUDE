/**
 * Formatação única de percentual de aderência/execução para UI.
 * Não altera numerador/denominador nem a fórmula — só a apresentação.
 *
 * Regras:
 * - numerador === denominador → "100%"
 * - demais valores → uma casa decimal com vírgula (pt-BR), ex.: "99,5%"
 */

export function formatAdherencePercent(
  percent: number | null | undefined,
  opts?: {
    realizados?: number | null;
    elegiveis?: number | null;
  },
): string {
  const realizados = opts?.realizados;
  const elegiveis = opts?.elegiveis;

  if (elegiveis != null && elegiveis > 0 && realizados != null && Number.isFinite(realizados)) {
    if (realizados === elegiveis) return "100%";
    const raw = (realizados / elegiveis) * 100;
    return formatOneDecimalPercent(raw);
  }

  if (percent == null || Number.isNaN(Number(percent))) return "—";

  const value = Number(percent);
  if (value === 100) return "100%";
  return formatOneDecimalPercent(value);
}

function formatOneDecimalPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toFixed(1).replace(".", ",")}%`;
}
