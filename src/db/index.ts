import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schemas";
import { requireDatabaseUrl } from "@/lib/env";

type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  __emserhDb?: Db;
};

/**
 * Cliente lazy: não conecta no escopo de módulo durante o build.
 */
export function getDb(): Db {
  if (globalForDb.__emserhDb) return globalForDb.__emserhDb;
  const url = requireDatabaseUrl();
  const sql = neon(url);
  const db = drizzle(sql, { schema });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__emserhDb = db;
  }
  return db;
}
