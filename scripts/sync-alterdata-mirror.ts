/**
 * Sync local somente-leitura do espelho.
 * Uso: npm run sync:mirror
 */
import "dotenv/config";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { syncAlterdataMirror } = await import("../src/lib/sheets/mirror-sync");
  console.log("Lendo espelho Alterdata (GET somente-leitura)...");
  const result = await syncAlterdataMirror();
  console.log(result);
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
