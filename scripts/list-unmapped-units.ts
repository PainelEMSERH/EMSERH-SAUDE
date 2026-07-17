/**
 * Lista unidades sem regional oficial (null ou NAO_INFORMADA).
 * Uso: npx tsx scripts/list-unmapped-units.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { Client } from "pg";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const q = await client.query<{
    name: string;
    regional: string | null;
    emp: number;
  }>(`
    select
      u.name,
      coalesce(r.code, '(sem regional)') as regional,
      (select count(*)::int
         from core.employees e
        where e.unit_id = u.id and e.deleted_at is null) as emp
    from core.units u
    left join core.regions r on r.id = u.region_id and r.deleted_at is null
    where u.deleted_at is null
      and (
        u.region_id is null
        or upper(coalesce(r.code, '')) in ('NAO_INFORMADA', 'NAO_INFORMADO', '')
        or upper(coalesce(r.name, '')) similar to '%NAO.?INFORMAD%'
      )
    order by emp desc, u.name
  `);

  console.log(`Total: ${q.rows.length} unidades sem regional oficial\n`);
  console.log(
    q.rows
      .map(
        (r, i) =>
          `${String(i + 1).padStart(3, " ")}. ${r.name}  ·  ${r.regional}  ·  ${r.emp} colab.`,
      )
      .join("\n"),
  );

  await client.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
