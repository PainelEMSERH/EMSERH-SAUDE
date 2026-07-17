import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

async function main() {
  const url =
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_UNPOOLED/DATABASE_URL missing");

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );
  `);

  const migrationsDir = path.join(process.cwd(), "src/db/migrations");
  const journal = JSON.parse(
    readFileSync(path.join(migrationsDir, "meta/_journal.json"), "utf8"),
  );

  for (const entry of journal.entries) {
    const tag = entry.tag as string;
    const existing = await client.query(
      `select 1 from "__drizzle_migrations" where hash = $1 limit 1`,
      [tag],
    );
    if (existing.rowCount) {
      console.log("skip", tag);
      continue;
    }

    const sqlFile = path.join(migrationsDir, `${tag}.sql`);
    const sql = readFileSync(sqlFile, "utf8");
    console.log("apply", tag);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        `insert into "__drizzle_migrations" (hash, created_at) values ($1, $2)`,
        [tag, entry.when ?? Date.now()],
      );
      await client.query("COMMIT");
      console.log("ok", tag);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }

  const schemas = await client.query(`
    select schema_name
    from information_schema.schemata
    where schema_name in ('auth','core','occupational','files','reporting','audit')
    order by 1
  `);
  const tables = await client.query(`
    select table_schema, count(*)::int as n
    from information_schema.tables
    where table_schema in ('auth','core','occupational','files','reporting','audit')
    group by 1
    order by 1
  `);
  console.log("schemas", schemas.rows);
  console.log("tables", tables.rows);
  await client.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
