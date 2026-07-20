import { createHash } from "node:crypto";
import {
  ADMISSIONAL_REGISTRATION,
  type ClinicAttendanceType,
  type ClinicSituation,
} from "@/lib/clinic-aso/types";

export function onlyDigits(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

export function padCpfDigits(digits: string): string {
  const d = onlyDigits(digits);
  if (!d) return "";
  if (d.length < 11) return d.padStart(11, "0");
  if (d.length > 11) return d.slice(-11);
  return d;
}

export function normalizeCpf(value: string): string {
  return padCpfDigits(value);
}

export function isValidCpf(value: string): boolean {
  const cpf = padCpfDigits(onlyDigits(value));
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === Number(cpf[10]);
}

export function preserveRegistration(
  value: string | number | null | undefined,
): string {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  return String(value).trim().replace(/\s+/g, "");
}

export function normalizeRegistration(
  registration: string,
  attendanceType: ClinicAttendanceType,
): string {
  if (attendanceType === "Admissional") return ADMISSIONAL_REGISTRATION;
  return preserveRegistration(registration);
}

export function situationForAttendance(
  attendanceType: ClinicAttendanceType,
  situation: ClinicSituation,
): ClinicSituation {
  if (attendanceType === "Consulta") return "Realizada";
  if (situation === "Realizada") return "Apto";
  return situation;
}

export function calculateBmi(
  weightKg: number | null | undefined,
  heightCm: number | null | undefined,
): number | null {
  if (weightKg == null || heightCm == null) return null;
  if (weightKg <= 0 || heightCm <= 0) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 100) / 100;
}

export function classifyBmi(bmi: number | null | undefined): string {
  if (bmi == null || Number.isNaN(bmi)) return "";
  if (bmi < 18.5) return "Abaixo do peso";
  if (bmi < 25) return "Peso normal";
  if (bmi < 30) return "Sobrepeso";
  if (bmi < 35) return "Obesidade grau I";
  if (bmi < 40) return "Obesidade grau II";
  return "Obesidade grau III";
}

export function parseIsoDate(value: string | number | Date): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + value * 86400000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const v = String(value).trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(`${v.slice(0, 10)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) {
    const d = new Date(`${br[3]}-${br[2]}-${br[1]}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function toIsoDate(value: string | number | Date): string | null {
  const d = parseIsoDate(value);
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function calculateAge(
  birthDate: string | null | undefined,
  refDate: Date = new Date(),
): number | null {
  if (!birthDate) return null;
  const birth = parseIsoDate(birthDate);
  if (!birth) return null;
  let age = refDate.getFullYear() - birth.getFullYear();
  const m = refDate.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && refDate.getDate() < birth.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

export function sha256Hex(input: Buffer | string): string {
  return createHash("sha256").update(input).digest("hex");
}
