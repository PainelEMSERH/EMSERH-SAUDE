import { get } from "@vercel/blob";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { attachments, employees } from "@/db/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { requireEmployeeInUserScope } from "@/lib/scope";

export const dynamic = "force-dynamic";

async function resolveEmployeeIdForAttachment(
  entityType: string,
  entityId: string,
): Promise<string | null> {
  const db = getDb();
  const t = entityType.toLowerCase();

  if (t === "employee" || t === "employees") {
    return entityId;
  }

  // Anexos ligados ao colaborador via tabela employees (existência)
  if (t.includes("employee")) {
    const [row] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.id, entityId), isNull(employees.deletedAt)))
      .limit(1);
    return row?.id ?? null;
  }

  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !can(user, "files", "view")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
  }

  const db = getDb();
  const [file] = await db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.id, id),
        isNull(attachments.deletedAt),
        eq(attachments.status, "ACTIVE"),
      ),
    )
    .limit(1);

  if (!file) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  const employeeId = await resolveEmployeeIdForAttachment(
    file.entityType,
    file.entityId,
  );
  if (employeeId) {
    try {
      await requireEmployeeInUserScope(user, { employeeId });
    } catch {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }
  } else if (user.scopeLevel !== "EMSERH") {
    // Sem vínculo claro a colaborador: só escopo institucional
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Armazenamento de arquivos não configurado." },
      { status: 503 },
    );
  }

  const blob = await get(file.pathname, {
    access: "private",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    return NextResponse.json(
      { error: "Conteúdo indisponível no armazenamento." },
      { status: 404 },
    );
  }

  await writeAuditLog({
    user,
    action: "FILE_DOWNLOAD",
    entityType: "attachment",
    entityId: file.id,
    metadata: {
      category: file.category,
      originalName: file.originalName,
      entityType: file.entityType,
    },
  });

  const headers = new Headers();
  headers.set("Content-Type", file.mimeType || "application/octet-stream");
  headers.set(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
  );
  if (file.sizeBytes) {
    headers.set("Content-Length", String(file.sizeBytes));
  }
  headers.set("Cache-Control", "private, no-store");

  return new NextResponse(blob.stream, { status: 200, headers });
}
