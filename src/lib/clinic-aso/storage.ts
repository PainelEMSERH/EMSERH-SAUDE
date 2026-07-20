import { put } from "@vercel/blob";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { clinicEnv, isClinicDriveConfigured } from "@/lib/clinic-aso/env";
import { uploadClinicAsoToDrive } from "@/lib/clinic-aso/drive";

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
  // No Vercel o filesystem do app é read-only; /tmp é gravável (efêmero).
  if (isServerlessRuntime()) return path.join("/tmp", "asos");
  return path.join(process.cwd(), "data", "asos");
}

export type ClinicAsoStoreResult = {
  url: string;
  storedName: string;
  backend: "blob" | "drive" | "local";
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
  if (token) {
    const blob = await put(`clinic-aso/${storedName}`, bytes, {
      access: "public",
      token,
      contentType,
    });
    return { url: blob.url, storedName, backend: "blob" };
  }

  if (isClinicDriveConfigured()) {
    try {
      const drive = await uploadClinicAsoToDrive({
        fileName: safe || storedName,
        mimeType: contentType,
        bytes,
      });
      return {
        url: drive.webViewLink,
        storedName: drive.fileId,
        backend: "drive",
      };
    } catch (e) {
      console.error("[clinic-aso/storage] drive fallback", e);
      // segue para disco local /tmp
    }
  }

  const dir = localAsoDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storedName), bytes);
  return {
    url: `/api/atendimento-aso/file?name=${encodeURIComponent(storedName)}`,
    storedName,
    backend: "local",
    ephemeral: isServerlessRuntime(),
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
