import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requirePermission } from "@/lib/auth/guard";
import { clinicEnv } from "@/lib/clinic-aso/env";

export async function GET(req: Request) {
  try {
    await requirePermission("attendances", "view");
  } catch {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const name = new URL(req.url).searchParams.get("name");
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return NextResponse.json({ error: "Arquivo inválido." }, { status: 400 });
  }

  const dir = clinicEnv(
    "ASO_STORAGE_DIR",
    path.join(process.cwd(), "data", "asos"),
  );
  try {
    const buf = await readFile(path.join(dir, name));
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${name}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  }
}
