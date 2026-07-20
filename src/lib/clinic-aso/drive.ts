import { Readable } from "node:stream";
import { google } from "googleapis";
import {
  clinicEnv,
  isClinicDriveConfigured,
} from "@/lib/clinic-aso/env";

export type DriveUploadResult = {
  fileId: string;
  webViewLink: string;
};

export async function uploadClinicAsoToDrive(input: {
  fileName: string;
  mimeType?: string;
  bytes: Buffer;
}): Promise<DriveUploadResult> {
  if (!isClinicDriveConfigured()) {
    throw new Error(
      "Google Drive não configurado. Defina GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY e GOOGLE_DRIVE_FOLDER_ID.",
    );
  }

  const email = clinicEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const key = clinicEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const folderId = clinicEnv("GOOGLE_DRIVE_FOLDER_ID");

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  const drive = google.drive({ version: "v3", auth });

  const created = await drive.files.create({
    requestBody: {
      name: input.fileName,
      parents: folderId ? [folderId] : undefined,
    },
    media: {
      mimeType: input.mimeType || "application/pdf",
      body: Readable.from(input.bytes),
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  const fileId = created.data.id;
  if (!fileId) throw new Error("Drive não retornou fileId.");

  let webViewLink = created.data.webViewLink || "";
  if (!webViewLink) {
    const meta = await drive.files.get({
      fileId,
      fields: "webViewLink",
      supportsAllDrives: true,
    });
    webViewLink =
      meta.data.webViewLink ||
      `https://drive.google.com/file/d/${fileId}/view`;
  }

  return { fileId, webViewLink };
}
