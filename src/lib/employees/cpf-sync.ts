import { hashCpf, normalizeCpf, encryptField } from "@/lib/encryption";

export type CpfSyncDiagnostic =
  | "CPF_PRESENT_VALID"
  | "CPF_MISSING"
  | "CPF_INVALID_LENGTH"
  | "CPF_DUPLICATE_HASH"
  | "CPF_ENCRYPTION_UNAVAILABLE";

export type CpfSyncDecision = {
  /** Hash a gravar (null se conflito/ausente — não apaga existente se caller usar coalesce). */
  cpfHash: string | null;
  /** Criptografia a gravar (preservada mesmo em conflito de hash). */
  cpfEncrypted: string | null;
  diagnostic: CpfSyncDiagnostic;
  /** Matrícula que já detém o hash, quando aplicável. */
  conflictRegistration?: string;
  /** Se true, o caller deve mesclar com valores existentes (não sobrescrever com null). */
  preserveExisting: boolean;
};

/**
 * Decide hash/encrypted a partir do CSV sem descartar cpfEncrypted em duplicidade.
 * Matrícula permanece a chave; unique de cpfHash é respeitado sem apagar o encrypted.
 */
export function decideCpfSyncFields(input: {
  cpfRaw: string;
  registration: string;
  /** Hash já visto nesta sincronização → dono da matrícula. */
  hashOwnerInBatch?: string | null;
  /** Matrícula no banco que já possui este hash (outra pessoa). */
  hashOwnerInDb?: string | null;
  encryptionEnabled: boolean;
}): CpfSyncDecision {
  const raw = (input.cpfRaw || "").trim();
  if (!raw) {
    return {
      cpfHash: null,
      cpfEncrypted: null,
      diagnostic: "CPF_MISSING",
      preserveExisting: true,
    };
  }

  const digits = normalizeCpf(raw);
  if (digits.length !== 11) {
    return {
      cpfHash: null,
      cpfEncrypted: null,
      diagnostic: "CPF_INVALID_LENGTH",
      preserveExisting: true,
    };
  }

  const hash = hashCpf(digits);
  let encrypted: string | null = null;
  if (input.encryptionEnabled) {
    try {
      encrypted = encryptField(digits);
    } catch {
      return {
        cpfHash: null,
        cpfEncrypted: null,
        diagnostic: "CPF_ENCRYPTION_UNAVAILABLE",
        preserveExisting: true,
      };
    }
  }

  const batchOwner = input.hashOwnerInBatch || null;
  const dbOwner = input.hashOwnerInDb || null;

  const conflictBatch =
    batchOwner && batchOwner !== input.registration ? batchOwner : null;
  const conflictDb = dbOwner && dbOwner !== input.registration ? dbOwner : null;
  const conflict = conflictBatch || conflictDb;

  if (conflict) {
    return {
      cpfHash: null,
      cpfEncrypted: encrypted,
      diagnostic: "CPF_DUPLICATE_HASH",
      conflictRegistration: conflict,
      preserveExisting: false,
    };
  }

  return {
    cpfHash: hash,
    cpfEncrypted: encrypted,
    diagnostic: "CPF_PRESENT_VALID",
    preserveExisting: false,
  };
}

/** Mescla decisão de sync com valores já persistidos (não apagar válido com vazio/inválido). */
export function mergeCpfFields(input: {
  decision: CpfSyncDecision;
  existingHash: string | null | undefined;
  existingEncrypted: string | null | undefined;
}): { cpfHash: string | null; cpfEncrypted: string | null } {
  const { decision, existingHash, existingEncrypted } = input;

  if (decision.preserveExisting) {
    return {
      cpfHash: existingHash ?? null,
      cpfEncrypted: existingEncrypted ?? null,
    };
  }

  if (decision.diagnostic === "CPF_DUPLICATE_HASH") {
    return {
      // Não grava hash duplicado; preserva hash próprio se já existir nesta matrícula
      cpfHash: existingHash ?? null,
      // Novo encrypted do CSV, ou preserva o existente
      cpfEncrypted: decision.cpfEncrypted ?? existingEncrypted ?? null,
    };
  }

  return {
    cpfHash: decision.cpfHash ?? existingHash ?? null,
    cpfEncrypted: decision.cpfEncrypted ?? existingEncrypted ?? null,
  };
}

export type CpfSyncStats = {
  presentValid: number;
  missing: number;
  invalid: number;
  duplicateConflict: number;
  encryptionUnavailable: number;
};

export function emptyCpfSyncStats(): CpfSyncStats {
  return {
    presentValid: 0,
    missing: 0,
    invalid: 0,
    duplicateConflict: 0,
    encryptionUnavailable: 0,
  };
}

export function tallyCpfDiagnostic(
  stats: CpfSyncStats,
  diagnostic: CpfSyncDiagnostic,
) {
  switch (diagnostic) {
    case "CPF_PRESENT_VALID":
      stats.presentValid += 1;
      break;
    case "CPF_MISSING":
      stats.missing += 1;
      break;
    case "CPF_INVALID_LENGTH":
      stats.invalid += 1;
      break;
    case "CPF_DUPLICATE_HASH":
      stats.duplicateConflict += 1;
      break;
    case "CPF_ENCRYPTION_UNAVAILABLE":
      stats.encryptionUnavailable += 1;
      break;
  }
}
