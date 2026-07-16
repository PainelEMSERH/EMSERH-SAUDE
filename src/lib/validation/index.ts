import { z } from "zod";

export const emailSchema = z.string().email();

export const registrationSchema = z
  .string()
  .trim()
  .min(1, "Matrícula obrigatória.")
  .max(30);

export const asoTypeSchema = z.enum([
  "ADMISSIONAL",
  "PERIODICO",
  "RETORNO_TRABALHO",
  "MUDANCA_RISCO",
  "DEMISSIONAL",
]);

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCid(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function normalizeRegionName(value: string): string {
  const n = normalizeText(value);
  if (n === "CENTRO" || n === "CENTRAL") return "CENTRAL";
  return n;
}
