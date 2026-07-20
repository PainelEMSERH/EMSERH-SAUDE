import { put } from "@vercel/blob";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { clinicEnv } from "@/lib/clinic-aso/env";

export async function storeClinicAsoFile(
  fileName: string,
  bytes: Buffer,
): Promise<{ url: string; storedName: string }> {
  const safe = fileName.replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
  const storedName = `${Date.now()}-${safe}`;

  const token = clinicEnv("BLOB_READ_WRITE_TOKEN") || process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const blob = await put(storedName, bytes, {
      access: "public",
      token,
      contentType: "application/pdf",
    });
    return { url: blob.url, storedName };
  }

  const dir = clinicEnv(
    "ASO_STORAGE_DIR",
    path.join(process.cwd(), "data", "asos"),
  );
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storedName), bytes);
  return {
    url: `/api/atendimento-aso/file?name=${encodeURIComponent(storedName)}`,
    storedName,
  };
}

export async function loadClinicAsoBytes(
  asoBlobUrl: string | null | undefined,
): Promise<Buffer | null> {
  if (!asoBlobUrl) return null;
  if (asoBlobUrl.startsWith("http://") || asoBlobUrl.startsWith("https://")) {
    const res = await fetch(asoBlobUrl);
    if (!res.ok) throw new Error("Não foi possível baixar o ASO.");
    return Buffer.from(await res.arrayBuffer());
  }
  const name = new URL(asoBlobUrl, "http://local").searchParams.get("name");
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return null;
  }
  const dir = clinicEnv(
    "ASO_STORAGE_DIR",
    path.join(process.cwd(), "data", "asos"),
  );
  return readFile(path.join(dir, name));
}
