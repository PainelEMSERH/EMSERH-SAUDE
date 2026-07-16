import { NextResponse } from "next/server";
import { isAuthConfigured, isDatabaseConfigured } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: process.env.NEXT_PUBLIC_APP_NAME ?? "EMSERH Saúde Ocupacional",
    databaseConfigured: isDatabaseConfigured(),
    authConfigured: isAuthConfigured(),
    timestamp: new Date().toISOString(),
  });
}
