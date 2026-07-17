import { Client } from "pg";

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL_UNPOOLED,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const schemas = await c.query(
    `select schema_name from information_schema.schemata
     where schema_name in ('auth','core','occupational','files','reporting','audit')
     order by 1`,
  );
  const tables = await c.query(
    `select table_schema || '.' || table_name as t
     from information_schema.tables
     where table_schema in ('auth','core','occupational','files','reporting','audit')
     order by 1`,
  );
  console.log("schemas", schemas.rows.map((r) => r.schema_name));
  console.log("tables_count", tables.rowCount);
  console.log(tables.rows.map((r) => r.t).join("\n"));
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
