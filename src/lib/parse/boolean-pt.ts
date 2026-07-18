/**
 * Interpreta booleanos comuns em planilhas PT-BR.
 * Evita `Boolean("NÃO") === true`.
 */
export function parseBooleanPtBr(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value == null) return false;
  if (typeof value === "number") return value !== 0 && !Number.isNaN(value);

  const raw = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  if (!raw) return false;

  if (
    raw === "N" ||
    raw === "NAO" ||
    raw === "FALSE" ||
    raw === "0" ||
    raw === "F" ||
    raw === "NEGATIVO" ||
    raw === "NAO REALIZADA" ||
    raw === "NAO INICIADO"
  ) {
    return false;
  }

  return (
    raw === "S" ||
    raw === "SIM" ||
    raw === "TRUE" ||
    raw === "1" ||
    raw === "V" ||
    raw === "VERDADEIRO" ||
    raw === "REALIZADA" ||
    raw === "REALIZADO" ||
    raw === "INICIADO" ||
    raw.startsWith("SIM")
  );
}
