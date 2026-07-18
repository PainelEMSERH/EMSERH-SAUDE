import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { isAuthConfigured, isDatabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const databaseConfigured = isDatabaseConfigured();
  const authConfigured = isAuthConfigured();

  let databaseReachable: boolean | null = null;
  let databaseLatencyMs: number | null = null;

  if (databaseConfigured) {
    const started = Date.now();
    try {
      const db = getDb();
      await Promise.race([
        db.execute(sql`select 1`),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 2500),
        ),
      ]);
      databaseReachable = true;
      databaseLatencyMs = Date.now() - started;
    } catch {
      databaseReachable = false;
      databaseLatencyMs = Date.now() - started;
    }
  }

  const ok =
    databaseConfigured &&
    authConfigured &&
    (databaseReachable === null || databaseReachable === true);

  return NextResponse.json(
    {
      ok,
      app: process.env.NEXT_PUBLIC_APP_NAME ?? "EMSERH Saúde Ocupacional",
      databaseConfigured,
      databaseReachable,
      databaseLatencyMs,
      authConfigured,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
