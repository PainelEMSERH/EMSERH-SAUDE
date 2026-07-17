/**
 * Corrige regionais das unidades listadas (ex.: agências transfusionais).
 * Uso: npx tsx scripts/fix-unit-regions.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { Client } from "pg";

config({ path: resolve(process.cwd(), ".env.local") });

const TARGETS: Array<[string, string]> = [
  ["CAF - FEME", "NORTE"],
  ["AGENCIA TRANSFUSIONAL TIMON", "LESTE"],
  ["AGENCIA TRANSFUSIONAL DE VIANA", "NORTE"],
  ["AGENCIA TRANSFUSIONAL DE SÃO JOÃO DOS PATOS", "CENTRO"],
  ["AGENCIA TRANSFUSIONAL DE CURURUPU", "NORTE"],
  ["AGENCIA TRANSFUSIONAL COLINAS", "CENTRO"],
  ["AGENCIA TRANSFUSIONAL CHAPADINHA", "LESTE"],
  ["AGENCIA TRANSFUSIONAL BARRA DO CORDA", "CENTRO"],
];

const REGION_META: Record<string, { code: string; name: string }> = {
  NORTE: { code: "NORTE", name: "Norte" },
  SUL: { code: "SUL", name: "Sul" },
  LESTE: { code: "LESTE", name: "Leste" },
  CENTRO: { code: "CENTRO", name: "Centro" },
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[–—−]/g, "-")
    .trim();
}

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const regionIds = new Map<string, string>();
  for (const key of Object.keys(REGION_META)) {
    const meta = REGION_META[key];
    const found = await client.query<{ id: string }>(
      `select id from core.regions
       where deleted_at is null and upper(code) = $1
       limit 1`,
      [meta.code],
    );
    if (!found.rows[0]) {
      throw new Error(`Regional ${meta.code} não encontrada`);
    }
    regionIds.set(key, found.rows[0].id);
  }

  const report: Array<Record<string, unknown>> = [];

  for (const [officialName, regionCode] of TARGETS) {
    const targetRegionId = regionIds.get(regionCode)!;
    const norm = normalizeText(officialName);

    const matches = await client.query<{
      id: string;
      name: string;
      region_id: string | null;
      region_code: string | null;
      emp: number;
    }>(
      `select u.id, u.name, u.region_id, r.code as region_code,
              (select count(*)::int from core.employees e
               where e.unit_id = u.id and e.deleted_at is null) as emp
       from core.units u
       left join core.regions r on r.id = u.region_id
       where u.deleted_at is null`,
    );

    const candidates = matches.rows.filter((u) => {
      const n = normalizeText(u.name);
      return (
        n === norm ||
        n.includes(norm) ||
        norm.includes(n) ||
        // Cururupu / Patos variações
        (norm.includes("CURURUPU") && n.includes("CURURUPU")) ||
        (norm.includes("SAO JOAO DOS PATOS") && n.includes("SAO JOAO DOS PATOS")) ||
        (norm.includes("BARRA DO CORDA") &&
          n.includes("TRANSFUSIONAL") &&
          n.includes("BARRA DO CORDA")) ||
        (norm.includes("CHAPADINHA") &&
          n.includes("TRANSFUSIONAL") &&
          n.includes("CHAPADINHA")) ||
        (norm.includes("COLINAS") &&
          n.includes("TRANSFUSIONAL") &&
          n.includes("COLINAS")) ||
        (norm.includes("VIANA") &&
          n.includes("TRANSFUSIONAL") &&
          n.includes("VIANA")) ||
        (norm.includes("TIMON") &&
          n.includes("TRANSFUSIONAL") &&
          n.includes("TIMON")) ||
        (norm === "CAF - FEME" && (n === "CAF - FEME" || n === "CAF FEME"))
      );
    });

    // Prefer exact normalized match
    let units = candidates.filter((u) => normalizeText(u.name) === norm);
    if (!units.length) units = candidates;

    if (!units.length) {
      report.push({
        officialName,
        regionCode,
        status: "NOT_FOUND",
      });
      continue;
    }

    // Keep canonical unit on target region if exists; else pick richest by employees
    const onTarget = units.find((u) => u.region_id === targetRegionId);
    const canonical =
      onTarget ||
      [...units].sort((a, b) => b.emp - a.emp || a.name.localeCompare(b.name))[0];

    // Point canonical to target region (safe if already there)
    if (canonical.region_id !== targetRegionId) {
      // If another unit with same name already sits on target region, merge into it
      const conflict = await client.query<{ id: string }>(
        `select id from core.units
         where deleted_at is null
           and region_id = $1
           and upper(translate(name,
             'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
             'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC'))
             = upper(translate($2,
             'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
             'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC'))
           and id <> $3
         limit 1`,
        [targetRegionId, canonical.name, canonical.id],
      );

      if (conflict.rows[0]) {
        const keepId = conflict.rows[0].id;
        await client.query(
          `update core.employees set unit_id = $1, region_id = $2, updated_at = now()
           where unit_id = $3 and deleted_at is null`,
          [keepId, targetRegionId, canonical.id],
        );
        await client.query(
          `update occupational.aso_monthly_plans
           set unit_id = $1, region_id = $2,
               region_name_snapshot = $3,
               updated_at = now()
           where unit_id = $4 and deleted_at is null`,
          [keepId, targetRegionId, REGION_META[regionCode].name, canonical.id],
        );
        await client.query(
          `update core.units set deleted_at = now(), updated_at = now() where id = $1`,
          [canonical.id],
        );
        report.push({
          officialName,
          regionCode,
          status: "MERGED_INTO_EXISTING",
          from: canonical.id,
          into: keepId,
        });
        continue;
      }

      await client.query(
        `update core.units set region_id = $2, updated_at = now() where id = $1`,
        [canonical.id, targetRegionId],
      );
    }

    // Merge duplicate units (same name on other regions) into canonical
    for (const dup of units) {
      if (dup.id === canonical.id) continue;
      await client.query(
        `update core.employees set unit_id = $1, region_id = $2, updated_at = now()
         where unit_id = $3 and deleted_at is null`,
        [canonical.id, targetRegionId, dup.id],
      );
      await client.query(
        `update occupational.aso_monthly_plans
         set unit_id = $1, region_id = $2,
             region_name_snapshot = $3,
             updated_at = now()
         where unit_id = $4 and deleted_at is null`,
        [canonical.id, targetRegionId, REGION_META[regionCode].name, dup.id],
      );
      await client.query(
        `update core.units set deleted_at = now(), updated_at = now() where id = $1`,
        [dup.id],
      );
    }

    // Relink employees + ASO plans for canonical unit
    const emp = await client.query(
      `update core.employees
       set region_id = $2, updated_at = now()
       where unit_id = $1 and deleted_at is null
         and (region_id is distinct from $2)`,
      [canonical.id, targetRegionId],
    );
    const plans = await client.query(
      `update occupational.aso_monthly_plans
       set region_id = $2,
           region_name_snapshot = $3,
           updated_at = now()
       where unit_id = $1 and deleted_at is null
         and (region_id is distinct from $2
              or region_name_snapshot is distinct from $3)`,
      [canonical.id, targetRegionId, REGION_META[regionCode].name],
    );

    report.push({
      officialName,
      regionCode,
      status: "UPDATED",
      unitId: canonical.id,
      unitName: canonical.name,
      employeesRelinked: emp.rowCount ?? 0,
      plansUpdated: plans.rowCount ?? 0,
      duplicatesMerged: units.length - 1,
    });
  }

  console.log(JSON.stringify({ report }, null, 2));
  await client.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
