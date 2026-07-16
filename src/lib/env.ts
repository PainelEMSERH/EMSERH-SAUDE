import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_URL_UNPOOLED: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  FIELD_ENCRYPTION_KEY: z.string().min(32).optional(),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_NAME: z
    .string()
    .default("EMSERH Saúde Ocupacional"),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Configuração de ambiente inválida.");
  }
  cached = parsed.data;
  return cached;
}

export function requireDatabaseUrl(): string {
  const url = getEnv().DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL não configurada. Configure o Neon antes de usar o sistema.",
    );
  }
  return url;
}

export function requireAuthSecret(): string {
  const secret = getEnv().AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET não configurada. Defina um segredo com pelo menos 32 caracteres.",
    );
  }
  return secret;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32,
  );
}
