import { readFileSync } from "node:fs";
import { Client } from "pg";

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL_UNPOOLED,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  await c.query(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);
  const journal = JSON.parse(
    readFileSync("src/db/migrations/meta/_journal.json", "utf8"),
  );
  const tag = journal.entries[0].tag as string;
  const exists = await c.query(
    `select 1 from "__drizzle_migrations" where hash = $1`,
    [tag],
  );
  if (!exists.rowCount) {
    await c.query(
      `insert into "__drizzle_migrations" (hash, created_at) values ($1, $2)`,
      [tag, journal.entries[0].when],
    );
    console.log("migration_marked", tag);
  } else {
    console.log("migration_already_marked", tag);
  }
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
