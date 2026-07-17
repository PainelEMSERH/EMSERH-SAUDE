/**
 * Padroniza regionais: CENTRO, NORTE, LESTE, SUL.
 * OESTE → SUL | CENTRAL → CENTRO
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

  const regions = await client.query<{ id: string; code: string; name: string }>(
    `select id, code, name from core.regions where deleted_at is null`,
  );
  console.log("before", regions.rows);

  async function ensureRegion(code: string, name: string) {
    const found = await client.query<{ id: string }>(
      `select id from core.regions where deleted_at is null and upper(code) = $1 limit 1`,
      [code],
    );
    if (found.rows[0]) {
      await client.query(
        `update core.regions set name = $2, is_active = true, updated_at = now() where id = $1`,
        [found.rows[0].id, name],
      );
      return found.rows[0].id;
    }
    const ins = await client.query<{ id: string }>(
      `insert into core.regions (code, name, is_active) values ($1, $2, true) returning id`,
      [code, name],
    );
    return ins.rows[0].id;
  }

  const norteId = await ensureRegion("NORTE", "Norte");
  const sulId = await ensureRegion("SUL", "Sul");
  const lesteId = await ensureRegion("LESTE", "Leste");
  const centroId = await ensureRegion("CENTRO", "Centro");

  // CENTRAL → CENTRO
  const central = regions.rows.find((r) => r.code.toUpperCase() === "CENTRAL");
  if (central && central.id !== centroId) {
    const u = await client.query(
      `update core.units set region_id = $2, updated_at = now() where region_id = $1 and deleted_at is null`,
      [central.id, centroId],
    );
    const e = await client.query(
      `update core.employees set region_id = $2, updated_at = now() where region_id = $1 and deleted_at is null`,
      [central.id, centroId],
    );
    await client.query(
      `update core.regions set deleted_at = now(), is_active = false, updated_at = now() where id = $1`,
      [central.id],
    );
    console.log("merged CENTRAL → CENTRO", {
      units: u.rowCount,
      employees: e.rowCount,
    });
  }

  // OESTE → SUL
  const oeste = regions.rows.find((r) => r.code.toUpperCase() === "OESTE");
  if (oeste && oeste.id !== sulId) {
    const u = await client.query(
      `update core.units set region_id = $2, updated_at = now() where region_id = $1 and deleted_at is null`,
      [oeste.id, sulId],
    );
    const e = await client.query(
      `update core.employees set region_id = $2, updated_at = now() where region_id = $1 and deleted_at is null`,
      [oeste.id, sulId],
    );
    await client.query(
      `update core.regions set deleted_at = now(), is_active = false, updated_at = now() where id = $1`,
      [oeste.id],
    );
    console.log("merged OESTE → SUL", {
      units: u.rowCount,
      employees: e.rowCount,
    });
  }

  // Qualquer code CENTRO antigo com nome errado
  await client.query(
    `update core.regions set name = 'Centro', code = 'CENTRO', is_active = true, deleted_at = null, updated_at = now()
     where id = $1`,
    [centroId],
  );

  const after = await client.query(`
    select r.code, r.name, r.is_active, r.deleted_at is not null as deleted,
           count(distinct u.id)::int units,
           count(e.id)::int employees
    from core.regions r
    left join core.units u on u.region_id = r.id and u.deleted_at is null
    left join core.employees e on e.region_id = r.id and e.deleted_at is null
    group by r.id, r.code, r.name, r.is_active, r.deleted_at
    order by r.deleted_at nulls first, r.code
  `);

  console.log(JSON.stringify({ regions: after.rows, ids: { norteId, sulId, lesteId, centroId } }, null, 2));
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
