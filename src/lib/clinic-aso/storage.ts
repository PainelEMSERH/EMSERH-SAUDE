import { put } from "@vercel/blob";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { clinicEnv } from "@/lib/clinic-aso/env";

function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.VERCEL_ENV,
  );
}

function localAsoDir(): string {
  const configured = clinicEnv("ASO_STORAGE_DIR");
  if (configured) return configured;
  if (isServerlessRuntime()) return path.join("/tmp", "asos");
  return path.join(process.cwd(), "data", "asos");
}

export type ClinicAsoStoreResult = {
  url: string;
  storedName: string;
  backend: "blob" | "local";
  ephemeral?: boolean;
};

export async function storeClinicAsoFile(
  fileName: string,
  bytes: Buffer,
): Promise<ClinicAsoStoreResult> {
  const safe = fileName.replace(/[^\w.\-() ]+/g, "_").slice(0, 180);
  const storedName = `${Date.now()}-${safe}`;
  const contentType = "application/pdf";

  const token =
    clinicEnv("BLOB_READ_WRITE_TOKEN") || process.env.BLOB_READ_WRITE_TOKEN;

  if (!token && isServerlessRuntime()) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN não configurado no Vercel. Sem isso o PDF não pode ser guardado na nuvem.",
    );
  }

  if (token) {
    const blob = await put(`clinic-aso/${storedName}`, bytes, {
      access: "public",
      token,
      contentType,
    });
    return { url: blob.url, storedName, backend: "blob" };
  }

  const dir = localAsoDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storedName), bytes);
  return {
    url: `/api/atendimento-aso/file?name=${encodeURIComponent(storedName)}`,
    storedName,
    backend: "local",
    ephemeral: false,
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
  if (
    !name ||
    name.includes("..") ||
    name.includes("/") ||
    name.includes("\\")
  ) {
    return null;
  }
  return readFile(path.join(localAsoDir(), name));
}
