import { getDb } from "@/db";
import { auditLogs } from "@/db/schemas";
import type { SessionUser } from "@/types";

type AuditInput = {
  user?: SessionUser | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "secret",
  "cpfEncrypted",
  "cnsEncrypted",
  "clinicalNotes",
]);

function sanitize(data: Record<string, unknown> | null | undefined) {
  if (!data) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key)) {
      out[key] = "[redacted]";
    } else {
      out[key] = value;
    }
  }
  return out;
}

export async function writeAuditLog(input: AuditInput) {
  if (!process.env.DATABASE_URL) return;
  try {
    const db = getDb();
    await db.insert(auditLogs).values({
      userId: input.user?.id ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      beforeData: sanitize(input.beforeData),
      afterData: sanitize(input.afterData),
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    // Auditoria nunca deve derrubar o fluxo principal — mas não engolir em silêncio.
    console.error("[audit] falha ao gravar log", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
