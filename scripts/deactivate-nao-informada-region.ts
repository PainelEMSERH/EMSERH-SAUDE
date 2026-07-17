/**
 * Desativa a regional NAO_INFORMADA no filtro (is_active=false).
 * Mantém o registro para histórico/FK e fallback do sync.
 *
 * Uso: npx tsx scripts/deactivate-nao-informada-region.ts [--dry]
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { Client } from "pg";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const dry = process.argv.includes("--dry");
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");

  const c = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const before = await c.query(
    `select id, code, name, is_active
     from core.regions
     where deleted_at is null and code = 'NAO_INFORMADA'`,
  );
  console.log("BEFORE", before.rows);

  if (!before.rows.length) {
    console.log("Regional NAO_INFORMADA não encontrada.");
    await c.end();
    return;
  }

  if (!dry) {
    const upd = await c.query(
      `update core.regions
       set is_active = false, updated_at = now()
       where code = 'NAO_INFORMADA' and deleted_at is null
       returning id, code, name, is_active`,
    );
    console.log("UPDATED", upd.rows);
  }

  const filters = await c.query(
    `select code, name, is_active
     from core.regions
     where deleted_at is null and is_active = true
     order by name`,
  );
  console.log("FILTRO_ATIVO", filters.rows);

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
