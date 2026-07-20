import nodemailer from "nodemailer";
import { clinicEnv, isClinicSmtpConfigured } from "@/lib/clinic-aso/env";

export type ClinicMailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
};

export function buildClinicAsoEmail(input: {
  to: string;
  employeeName: string;
  registration: string;
  attendanceType: string;
  situation: string;
  date: string;
  physicianName: string;
  physicianCode: string;
  driveUrl?: string | null;
  pdfBytes: Buffer;
  filename: string;
}): ClinicMailInput {
  return {
    to: input.to,
    subject: `ASO ${input.attendanceType} — ${input.employeeName} (${input.registration})`,
    text: [
      `Colaborador: ${input.employeeName}`,
      `Matrícula: ${input.registration}`,
      `Tipo: ${input.attendanceType}`,
      `Situação: ${input.situation}`,
      `Data: ${input.date}`,
      `Médico: ${input.physicianName} (${input.physicianCode})`,
      input.driveUrl ? `Drive: ${input.driveUrl}` : "Drive: pendente",
      "O PDF do ASO segue em anexo.",
    ].join("\n"),
    attachments: [
      {
        filename: input.filename,
        content: input.pdfBytes,
        contentType: "application/pdf",
      },
    ],
  };
}

export async function sendClinicMail(input: ClinicMailInput): Promise<void> {
  if (!isClinicSmtpConfigured()) {
    throw new Error(
      "SMTP/Zimbra não configurado. Defina SMTP_HOST, SMTP_USER e SMTP_PASS.",
    );
  }

  const port = Number(clinicEnv("SMTP_PORT", "587"));
  const secure =
    clinicEnv("SMTP_SECURE", "false") === "true" || port === 465;

  const transporter = nodemailer.createTransport({
    host: clinicEnv("SMTP_HOST"),
    port,
    secure,
    auth: {
      user: clinicEnv("SMTP_USER"),
      pass: clinicEnv("SMTP_PASS"),
    },
  });

  await transporter.sendMail({
    from: clinicEnv("SMTP_FROM", clinicEnv("SMTP_USER")),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments: input.attachments,
  });
}
