import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { getEnv } from "@/lib/env";

function getKey(): Buffer | null {
  const key = getEnv().FIELD_ENCRYPTION_KEY;
  if (!key) return null;
  return createHash("sha256").update(key).digest();
}

export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

export function hashCpf(cpf: string): string {
  return createHash("sha256").update(normalizeCpf(cpf)).digest("hex");
}

export function maskCpf(cpf: string | null | undefined): string {
  if (!cpf) return "—";
  const n = normalizeCpf(cpf);
  if (n.length !== 11) return "***.***.***-**";
  return `***.${n.slice(3, 6)}.***-${n.slice(-2)}`;
}

export function maskCns(cns: string | null | undefined): string {
  if (!cns) return "—";
  const n = cns.replace(/\D/g, "");
  if (n.length < 4) return "************";
  return `************${n.slice(-3)}`;
}

export function encryptField(plain: string): string {
  const key = getKey();
  if (!key) {
    throw new Error("FIELD_ENCRYPTION_KEY não configurada.");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptField(payload: string): string {
  const key = getKey();
  if (!key) {
    throw new Error("FIELD_ENCRYPTION_KEY não configurada.");
  }
  const [version, ivB64, tagB64, dataB64] = payload.split(":");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Payload criptografado inválido.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
