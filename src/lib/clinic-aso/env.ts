function env(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export function clinicIntegrationsStatus() {
  return {
    drive: Boolean(
      env("GOOGLE_SERVICE_ACCOUNT_EMAIL") &&
        env("GOOGLE_PRIVATE_KEY") &&
        env("GOOGLE_DRIVE_FOLDER_ID"),
    ),
    smtp: Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASS")),
    ocr: Boolean(env("OCR_PROVIDER") && env("OCR_API_KEY")),
    ocrProvider: env("OCR_PROVIDER", "none"),
  };
}

export function clinicEnv(name: string, fallback = ""): string {
  return env(name, fallback);
}

export function isClinicDriveConfigured(): boolean {
  return clinicIntegrationsStatus().drive;
}

export function isClinicSmtpConfigured(): boolean {
  return clinicIntegrationsStatus().smtp;
}
