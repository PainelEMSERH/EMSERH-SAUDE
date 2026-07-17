import { decryptField, maskCpf, normalizeCpf } from "@/lib/encryption";

export type CpfDisplayStatus =
  | "AVAILABLE"
  | "MASKED"
  | "NOT_IN_ALTERDATA"
  | "HASH_ONLY"
  | "DECRYPTION_ERROR"
  | "INVALID";

export type CpfDisplayResult = {
  status: CpfDisplayStatus;
  display: string;
  /** Código seguro para logs/diagnóstico — nunca contém CPF. */
  diagnostic:
    | "CPF_PRESENT_VALID"
    | "CPF_MASKED"
    | "CPF_MISSING"
    | "CPF_HASH_ONLY"
    | "CPF_DECRYPTION_ERROR"
    | "CPF_INVALID_LENGTH";
};

/** Formata CPF 000.000.000-00 */
export function formatCpfDigits(digits: string): string {
  const n = normalizeCpf(digits);
  if (n.length !== 11) return digits;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

/**
 * Resolve CPF para exibição no servidor.
 * Diferencia ausência, mascaramento, hash-only e falha de descriptografia.
 * Nunca logar o valor descriptografado.
 */
export function resolveCpfDisplayResult(
  cpfEncrypted: string | null | undefined,
  cpfHash: string | null | undefined,
  canViewSensitive: boolean,
): CpfDisplayResult {
  const hasEncrypted = Boolean(cpfEncrypted?.trim());
  const hasHash = Boolean(cpfHash?.trim());

  if (!hasEncrypted && !hasHash) {
    return {
      status: "NOT_IN_ALTERDATA",
      display: canViewSensitive
        ? "Não informado no Alterdata"
        : maskCpf(null),
      diagnostic: "CPF_MISSING",
    };
  }

  if (!hasEncrypted && hasHash) {
    return {
      status: "HASH_ONLY",
      display: canViewSensitive
        ? "CPF importado, mas indisponível para exibição"
        : maskCpf(null),
      diagnostic: "CPF_HASH_ONLY",
    };
  }

  try {
    const plain = decryptField(cpfEncrypted!);
    const digits = normalizeCpf(plain);
    if (digits.length !== 11) {
      return {
        status: "INVALID",
        display: canViewSensitive
          ? "CPF inválido na origem"
          : maskCpf(null),
        diagnostic: "CPF_INVALID_LENGTH",
      };
    }
    if (canViewSensitive) {
      return {
        status: "AVAILABLE",
        display: formatCpfDigits(digits),
        diagnostic: "CPF_PRESENT_VALID",
      };
    }
    return {
      status: "MASKED",
      display: maskCpf(digits),
      diagnostic: "CPF_MASKED",
    };
  } catch {
    return {
      status: "DECRYPTION_ERROR",
      display: canViewSensitive
        ? "CPF indisponível por configuração"
        : maskCpf(null),
      diagnostic: "CPF_DECRYPTION_ERROR",
    };
  }
}

/** Compat: retorna apenas o texto de exibição. */
export function resolveCpfDisplay(
  cpfEncrypted: string | null | undefined,
  canViewSensitive: boolean,
  cpfHash?: string | null,
): string {
  return resolveCpfDisplayResult(cpfEncrypted, cpfHash, canViewSensitive)
    .display;
}

/** Formata telefone BR para exibição (não altera persistência). */
export function formatPhoneBR(phone: string | null | undefined): string {
  if (!phone?.trim()) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone.trim();
}
