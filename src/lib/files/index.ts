import { put } from "@vercel/blob";
import { createHash } from "node:crypto";
import { getDb } from "@/db";
import { attachments } from "@/db/schemas";
import { writeAuditLog } from "@/lib/audit";
import type { SessionUser } from "@/types";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function storePrivateAttachment(input: {
  file: File;
  entityType: string;
  entityId: string;
  category: string;
  user: SessionUser;
}) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN não configurado.");
  }
  if (input.file.size > MAX_BYTES) {
    throw new Error("Arquivo excede o limite de 10 MB.");
  }
  if (!ALLOWED.has(input.file.type)) {
    throw new Error("Tipo de arquivo não permitido.");
  }

  const buffer = Buffer.from(await input.file.arrayBuffer());
  const contentHash = createHash("sha256").update(buffer).digest("hex");
  const safeName = `${input.entityType}/${input.entityId}/${Date.now()}-${contentHash.slice(0, 12)}`;

  const blob = await put(safeName, buffer, {
    access: "private",
    contentType: input.file.type,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  const db = getDb();
  const [row] = await db
    .insert(attachments)
    .values({
      entityType: input.entityType,
      entityId: input.entityId,
      originalName: input.file.name,
      pathname: blob.pathname,
      mimeType: input.file.type,
      sizeBytes: input.file.size,
      contentHash,
      category: input.category,
      createdBy: input.user.id,
      updatedBy: input.user.id,
    })
    .returning();

  await writeAuditLog({
    user: input.user,
    action: "FILE_UPLOAD",
    entityType: "attachment",
    entityId: row.id,
    metadata: { category: input.category, sizeBytes: input.file.size },
  });

  return row;
}

export function attachmentDownloadUrl(attachmentId: string) {
  return `/api/files/${attachmentId}`;
}
