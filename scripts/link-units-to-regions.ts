/**
 * Associa unidades hospitalares às regionais oficiais.
 * Uso: npx tsx scripts/link-units-to-regions.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { Client } from "pg";

config({ path: resolve(process.cwd(), ".env.local") });

/** Mapa oficial: unidade → regional responsável */
const UNIT_REGION_MAP: Array<[string, string]> = [
  ["AGENCIA TRANSFUSIONAL BARRA DO CORDA", "CENTRO"],
  ["AGENCIA TRANSFUSIONAL CHAPADINHA", "LESTE"],
  ["AGENCIA TRANSFUSIONAL COLINAS", "CENTRO"],
  ["AGENCIA TRANSFUSIONAL DE SÃO JOÃO DOS PATOS", "CENTRO"],
  ["AGENCIA TRANSFUSIONAL DE VIANA", "NORTE"],
  ["AGENCIA TRANSFUSIONAL TIMON", "LESTE"],
  ["CAF - FEME", "NORTE"],
  ["CAF - SEDE EMSERH", "NORTE"],
  ["CASA DA GESTANTE, BEBE E PUERPERA", "SUL"],
  ["CASA TEA 12+", "NORTE"],
  ["CENTRAL DE REGULACAO - AMBULATORIAL", "NORTE"],
  ["CENTRAL DE REGULACAO - LEITOS", "NORTE"],
  ["CENTRAL DE REGULACAO - TRANSPORTE", "NORTE"],
  ["CENTRO DA PESSOA IDOSA", "SUL"],
  ["CENTRO DE SAUDE GENESIO REGO", "NORTE"],
  ["CENTRO DE TERAPIA RENAL SUBSTITUTIVA", "NORTE"],
  ["CENTRO ESPECIALIDADES MEDICAS PAM DIAMANTE", "NORTE"],
  ["CENTRO ESPECIALIZADO DE REAB. CIDADE OPERARIA", "NORTE"],
  ["CENTRO ESPECIALIZADO DE REABILITACAO OLHO D AGUA", "NORTE"],
  ["EMSERH SEDE", "NORTE"],
  ["EMSERH SEDE DIRETORIA", "NORTE"],
  ["FEME", "NORTE"],
  ["FEME - UGAF", "NORTE"],
  ["FEME DE CAXIAS", "LESTE"],
  ["FEME IMPERATRIZ", "SUL"],
  ["FESMA", "NORTE"],
  ["HEMOMAR", "NORTE"],
  ["HEMONUCLEO DE BACABAL", "CENTRO"],
  ["HEMONUCLEO DE BALSAS", "SUL"],
  ["HEMONUCLEO DE CAXIAS", "LESTE"],
  ["HEMONUCLEO DE CODO", "LESTE"],
  ["HEMONUCLEO DE IMPERATRIZ", "SUL"],
  ["HEMONUCLEO DE PEDREIRAS", "CENTRO"],
  ["HEMONUCLEO PINHEIRO", "NORTE"],
  ["HEMONUCLEO SANTA INES", "SUL"],
  ["HOSPITAL ADELIA MATOS FONSECA", "LESTE"],
  ["HOSPITAL AQUILES LISBOA", "NORTE"],
  ["HOSPITAL DA ILHA", "NORTE"],
  ["HOSPITAL DE BARREIRINHAS", "NORTE"],
  ["HOSPITAL DE CUIDADOS INTENSIVOS - HCI", "NORTE"],
  ["HOSPITAL DE PAULINO NEVES", "NORTE"],
  ["HOSPITAL DE PEDREIRAS", "CENTRO"],
  ["HOSPITAL E MATERNIDADE ADERSON MARINHO - P. FRANCO", "SUL"],
  ["HOSPITAL GENESIO REGO", "NORTE"],
  ["HOSPITAL GERAL DE ALTO ALEGRE", "LESTE"],
  ["HOSPITAL GERAL DE GRAJAU", "CENTRO"],
  ["HOSPITAL GERAL DE PERITORO", "LESTE"],
  ["HOSPITAL MACROREGIONAL DE CAXIAS", "LESTE"],
  ["HOSPITAL MACROREGIONAL DE COROATA", "LESTE"],
  ["HOSPITAL MACRORREGIONAL DRA RUTH NOLETO", "SUL"],
  ["HOSPITAL MATERNO INFANTIL IMPERATRIZ", "SUL"],
  ["HOSPITAL PRESIDENTE DUTRA", "CENTRO"],
  ["HOSPITAL PRESIDENTE VARGAS", "NORTE"],
  ["HOSPITAL REGIONAL ALARICO NUNES PACHECO - Timon", "LESTE"],
  ["HOSPITAL REGIONAL DE BARRA DO CORDA", "CENTRO"],
  ["HOSPITAL REGIONAL DE CARUTAPERA", "NORTE"],
  ["HOSPITAL REGIONAL DE CHAPADINHA", "LESTE"],
  ["HOSPITAL REGIONAL DE LAGO DA PEDRA", "CENTRO"],
  ["HOSPITAL REGIONAL DE MORROS", "NORTE"],
  ["HOSPITAL REGIONAL DE TIMBIRAS", "LESTE"],
  ["HOSPITAL REGIONAL SANTA LUZIA DO PARUA", "NORTE"],
  ["HOSPITAL VILA LUIZAO", "NORTE"],
  ["LACEN", "NORTE"],
  ["LACEN IMPERATRIZ", "SUL"],
  ["POLICLINICA AÇAILANDIA", "SUL"],
  ["POLICLINICA BARRA DO CORDA", "CENTRO"],
  ["POLICLINICA CAXIAS", "LESTE"],
  ["POLICLINICA CIDADE OPERARIA", "NORTE"],
  ["POLICLINICA COHATRAC", "NORTE"],
  ["POLICLINICA DE CODÓ", "LESTE"],
  ["POLICLINICA DE IMPERATRIZ", "SUL"],
  ["POLICLINICA DE MATOES DO NORTE", "LESTE"],
  ["POLICLINICA DO COROADINHO", "NORTE"],
  ["POLICLINICA DO CUJUPE", "NORTE"],
  ["POLICLINICA VILA LUIZAO", "NORTE"],
  ["POLICLINICA VINHAIS", "NORTE"],
  ["PROGRAMA DE ACAO INTEGRADA PARA APOSENTADOS - PAI", "NORTE"],
  ["RESIDENCIA MEDICA E MULTI - ANALISTAS TECNICOS", "NORTE"],
  ["SHOPPING DA CRIANÇA", "NORTE"],
  ["SOLAR DO OUTONO", "NORTE"],
  ["SVO -SERV. VERIFICAÇÃO DE ÓBITOS - SÃO LUÍS", "NORTE"],
  ["SVO -SERV. VERIFICAÇÃO DE ÓBITOS - TIMON", "LESTE"],
  ["SVO -SERV.VERIFICAÇÃO DE ÓBITOS - IMPERATRIZ", "SUL"],
  ["TEA - CENTRO ESPECIALIZADO DE REAB. OLHO D AGUA", "NORTE"],
  ["UPA ARACAGY", "NORTE"],
  ["UPA CIDADE OPERARIA", "NORTE"],
  ["UPA CODO", "LESTE"],
  ["UPA COROATA", "LESTE"],
  ["UPA DE IMPERATRIZ", "SUL"],
  ["UPA ITAQUI BACANGA", "NORTE"],
  ["UPA PAÇO DO LUMIAR", "NORTE"],
  ["UPA PARQUE VITORIA", "NORTE"],
  ["UPA SAO JOAO DOS PATOS", "CENTRO"],
  ["UPA TIMON", "LESTE"],
  ["UPA VINHAIS", "NORTE"],
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

function regionKey(value: string) {
  const n = normalizeText(value);
  if (n === "CENTRO" || n === "CENTRAL") return "CENTRO";
  return n;
}

function findUnit(
  byNorm: Map<string, { id: string; name: string; region_id: string | null }>,
  officialName: string,
) {
  const norm = normalizeText(officialName);
  const exact = byNorm.get(norm);
  if (exact) return exact;

  // fuzzy: melhor score por inclusão
  let best: { id: string; name: string; region_id: string | null } | null = null;
  let bestScore = 0;
  for (const [n, u] of byNorm) {
    if (n === norm) return u;
    if (n.includes(norm) || norm.includes(n)) {
      const score = Math.min(n.length, norm.length) / Math.max(n.length, norm.length);
      if (score > bestScore && score >= 0.72) {
        bestScore = score;
        best = u;
      }
    }
  }
  return best;
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

  for (const key of ["NORTE", "SUL", "LESTE", "CENTRO"] as const) {
    const meta = REGION_META[key];
    const codes =
      key === "CENTRO"
        ? ["CENTRO", "CENTRAL"]
        : key === "SUL"
          ? ["SUL", "OESTE"]
          : [meta.code, key];

    const found = await client.query<{ id: string; code: string }>(
      `select id, code from core.regions
       where deleted_at is null and upper(code) = any($1::text[])
       order by case when upper(code) = $2 then 0 else 1 end
       limit 1`,
      [codes, meta.code],
    );

    let id = found.rows[0]?.id;
    if (!id) {
      const ins = await client.query<{ id: string }>(
        `insert into core.regions (code, name, is_active)
         values ($1, $2, true)
         returning id`,
        [meta.code, meta.name],
      );
      id = ins.rows[0].id;
      console.log("created region", meta.code);
    } else {
      await client.query(
        `update core.regions
         set code = $2, name = $3, is_active = true, updated_at = now(), deleted_at = null
         where id = $1`,
        [id, meta.code, meta.name],
      );
    }
    regionIds.set(key, id);
    regionIds.set(meta.code, id);
  }

  const units = await client.query<{
    id: string;
    name: string;
    region_id: string | null;
  }>(`select id, name, region_id from core.units where deleted_at is null`);

  const byNorm = new Map<
    string,
    { id: string; name: string; region_id: string | null }
  >();
  for (const u of units.rows) {
    byNorm.set(normalizeText(u.name), u);
  }

  const stats = {
    official: UNIT_REGION_MAP.length,
    linked: 0,
    updated: 0,
    created: 0,
    employeesRelinked: 0,
    dbUnitsNotInOfficialList: [] as string[],
    fuzzyMatches: [] as Array<{ official: string; db: string }>,
  };

  const officialNorms = new Set(
    UNIT_REGION_MAP.map(([name]) => normalizeText(name)),
  );

  for (const [unitName, region] of UNIT_REGION_MAP) {
    const rk = regionKey(region);
    const regionId = regionIds.get(rk)!;
    let unit = findUnit(byNorm, unitName);

    if (unit && normalizeText(unit.name) !== normalizeText(unitName)) {
      stats.fuzzyMatches.push({ official: unitName, db: unit.name });
    }

    if (!unit) {
      const ins = await client.query<{ id: string }>(
        `insert into core.units (name, region_id, is_active)
         values ($1, $2, true)
         returning id`,
        [unitName, regionId],
      );
      unit = { id: ins.rows[0].id, name: unitName, region_id: regionId };
      byNorm.set(normalizeText(unitName), unit);
      stats.created += 1;
      console.log("created unit:", unitName, "→", rk);
    } else if (unit.region_id !== regionId) {
      await client.query(
        `update core.units set region_id = $2, updated_at = now() where id = $1`,
        [unit.id, regionId],
      );
      unit.region_id = regionId;
      stats.updated += 1;
    }

    const rel = await client.query(
      `update core.employees
       set region_id = $2, updated_at = now()
       where unit_id = $1
         and deleted_at is null
         and (region_id is distinct from $2)`,
      [unit.id, regionId],
    );
    stats.employeesRelinked += rel.rowCount ?? 0;
    stats.linked += 1;
  }

  for (const u of units.rows) {
    const n = normalizeText(u.name);
    let inOfficial = officialNorms.has(n);
    if (!inOfficial) {
      for (const on of officialNorms) {
        if (n.includes(on) || on.includes(n)) {
          const score =
            Math.min(n.length, on.length) / Math.max(n.length, on.length);
          if (score >= 0.72) {
            inOfficial = true;
            break;
          }
        }
      }
    }
    if (!inOfficial) stats.dbUnitsNotInOfficialList.push(u.name);
  }

  const summary = await client.query(`
    select r.code, r.name,
           count(distinct u.id)::int as units,
           count(e.id)::int as employees
    from core.regions r
    left join core.units u on u.region_id = r.id and u.deleted_at is null
    left join core.employees e on e.unit_id = u.id and e.deleted_at is null
    where r.deleted_at is null
    group by r.id, r.code, r.name
    order by r.code
  `);

  const sample = await client.query(`
    select u.name as unit, r.code as region, count(e.id)::int emp
    from core.units u
    join core.regions r on r.id = u.region_id
    left join core.employees e on e.unit_id = u.id and e.deleted_at is null
    where u.deleted_at is null
    group by u.name, r.code
    order by r.code, u.name
    limit 20
  `);

  console.log(
    JSON.stringify(
      {
        stats: {
          ...stats,
          dbUnitsNotInOfficialList: stats.dbUnitsNotInOfficialList.slice(0, 40),
          dbUnitsNotInOfficialCount: stats.dbUnitsNotInOfficialList.length,
          fuzzyMatches: stats.fuzzyMatches.slice(0, 20),
        },
        byRegion: summary.rows,
        sampleLinks: sample.rows,
      },
      null,
      2,
    ),
  );

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
