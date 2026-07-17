import { Client } from "pg";

async function main() {
  const c = new Client({
    connectionString:
      process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const r = await c.query(
    `update files.import_batches set status = 'CANCELLED' where status = 'RUNNING'`,
  );
  console.log("cancelled", r.rowCount);
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
