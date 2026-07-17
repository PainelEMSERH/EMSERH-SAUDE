import { decryptField, maskCpf, normalizeCpf } from "@/lib/encryption";

/** Formata CPF 000.000.000-00 */
export function formatCpfDigits(digits: string): string {
  const n = normalizeCpf(digits);
  if (n.length !== 11) return digits;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

/**
 * Resolve CPF para exibição no servidor.
 * Nunca logar o retorno em auditoria.
 */
export function resolveCpfDisplay(
  cpfEncrypted: string | null | undefined,
  canViewSensitive: boolean,
): string {
  if (!cpfEncrypted) return "—";
  try {
    const plain = decryptField(cpfEncrypted);
    const digits = normalizeCpf(plain);
    if (digits.length !== 11) return canViewSensitive ? "—" : maskCpf(null);
    return canViewSensitive ? formatCpfDigits(digits) : maskCpf(digits);
  } catch {
    return canViewSensitive ? "—" : maskCpf(null);
  }
}
