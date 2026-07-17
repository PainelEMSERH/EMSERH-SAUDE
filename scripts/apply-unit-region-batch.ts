/**
 * Aplica lote de regionais informado pela operação + inativa DESATIVADAS.
 * Uso: npx tsx scripts/apply-unit-region-batch.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { Client } from "pg";

config({ path: resolve(process.cwd(), ".env.local") });

/** Unidades ativas → regional oficial */
const ACTIVE: Array<[string, string]> = [
  // Centro
  ["CENTRO DE HEMODIALISE - BARRA DO CORDA", "CENTRO"],
  ["HEMONUCLEO DE BACABAL", "CENTRO"],
  ["HEMONUCLEO DE PEDREIRAS", "CENTRO"],
  // Leste
  ["FEME DE CAXIAS", "LESTE"],
  ["FEME PROGRAMA DO LEITE", "LESTE"],
  ["HEMONUCLEO DE CAXIAS", "LESTE"],
  ["HEMONUCLEO DE CODO", "LESTE"],
  ["HOSPITAL ADELIA MATOS FONSECA", "LESTE"],
  // Norte
  ["CAF - SEDE EMSERH", "NORTE"],
  ["CASA TEA 12+", "NORTE"],
  ["CENTRAL DE REGULACAO - AMBULATORIAL", "NORTE"],
  ["CENTRAL DE REGULACAO - LEITOS", "NORTE"],
  ["CENTRAL DE REGULACAO - TRANSPORTE", "NORTE"],
  ["CENTRAL DE REGULAÇÃO -TRATAMENTO FORA DO DOMICILIO", "NORTE"],
  ["CENTRO DE HEMODIALISE - SANTA LUZIA DO PARUA", "NORTE"],
  ["CENTRO DE SAUDE GENESIO REGO", "NORTE"],
  ["CENTRO DE TERAPIA RENAL SUBSTITUTIVA", "NORTE"],
  ["CENTRO ESPECIALIDADES MEDICAS PAM DIAMANTE", "NORTE"],
  ["CENTRO ESPECIALIZADO DE REAB. CIDADE OPERARIA", "NORTE"],
  ["CENTRO ESPECIALIZADO DE REABILITACAO OLHO D AGUA", "NORTE"],
  ["EMSERH SEDE", "NORTE"],
  ["EMSERH SEDE DIRETORIA", "NORTE"],
  ["FEME", "NORTE"],
  ["FEME - UGAF", "NORTE"],
  ["FESMA", "NORTE"],
  ["HEMOMAR", "NORTE"],
  ["HEMONUCLEO PINHEIRO", "NORTE"],
  ["HOSPITAL AQUILES LISBOA", "NORTE"],
  ["HOSPITAL DA ILHA", "NORTE"],
  ["NUCLEO DE GESTAO DA REGULACAO - NGR", "NORTE"],
  ["PROJETO GIRASSOL", "NORTE"],
  ["TEA - CIDADE OPERARIA", "NORTE"],
  // Sul
  ["AGENCIA TRANSFUSIONAL PORTO FRANCO", "SUL"],
  ["CASA DA GESTANTE, BEBE E PUERPERA", "SUL"],
  ["CENTRAL DE REGULACAO - MACRO SUL", "SUL"],
  ["CENTRO DA PESSOA IDOSA", "SUL"],
  ["FEME IMPERATRIZ", "SUL"],
  ["HEMONUCLEO DE BALSAS", "SUL"],
  ["HEMONUCLEO DE IMPERATRIZ", "SUL"],
  ["HEMONUCLEO SANTA INES", "SUL"],
];

/** Unidades desativadas (histórico; colaboradores demitidos). */
const DEACTIVATED: string[] = [
  "AGENCIA TRANSFUSIONAL BACABAL",
  "AGENCIA TRANSFUSIONAL DE COELHO NETO",
  "CARRETA DA MULHER",
  "CARRETA DE BARRETOS",
  "CASA DA GESTANTE",
  "CENTRAL DE REGULACAO",
  "CENTRO ESPECIALIDADES MEDICAS CEMESP",
  "CIAMS / POLICIA MILITAR",
  "CIEVS - NUCLEOS HOSPITALARES DE EPIDEMIOLOGIA",
  "CIEVS - VIGILÂNCIA EM SAÚDE",
  "CLÍNICA SÃO JOSE",
  "COVID - HOSPITAL GERAL DE GRAJAU",
  "COVID - HOSPITAL MACROREGIONAL DE CAXIAS",
  "COVID - HOSPITAL MACROREGIONAL DE COROATA",
  "EAP - EQUIPE DE APOIO PRISIONAL",
  "EMAP - HOSPITAL DE CAMPANHA DE SÃO LUIS",
  "EMSERH SEDE OPERACIONAL INTERIOR",
  "EMSERH SEDE OPERACIONAL SÃO LUIS",
  "HOSPITAL DE CAMPANHA DE AÇAILANDIA",
  "HOSPITAL DE CAMPANHA DE IMPERATRIZ",
  "HOSPITAL DE CAMPANHA DE SÃO LUIS",
  "HOSPITAL DE CANCER DR TARQUINIO LOPES FILHO",
  "HOSPITAL DO SERVIDOR DE SÃO LUIS",
  "HOSPITAL DR. CARLOS MACIEIRA COLINAS",
  "HOSPITAL GENTIL FILHO",
  "HOSPITAL REAL",
  "HOSPITAL SERVIDOR_ODONTOLOGIA",
  "RESIDENCIA MEDICA E MULTIDISCIPLINAR",
  "RETAGUARDA - HOSPITAL MACRORREGIONAL DE CAXIAS",
  "SUPERINTENDÊNCIA DE ATENÇÃO PRIMÁRIA EM SAÚDE",
  "UNIDADE DE CUIDADOS INTENSIVOS AÇAILANDIA",
  "UNIDADE DE CUIDADOS INTENSIVOS DE CODÓ",
  "UNIDADE MISTA MAIOBÃO",
  "UPA CAXIAS",
  "UPA CHAPADINHA",
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

function namesMatch(a: string, b: string) {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) {
    const score = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    return score >= 0.85;
  }
  return false;
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
    if (!found.rows[0]) throw new Error(`Regional ${meta.code} não encontrada`);
    regionIds.set(key, found.rows[0].id);
  }

  const allUnits = await client.query<{
    id: string;
    name: string;
    region_id: string | null;
    is_active: boolean;
    emp: number;
  }>(`
    select u.id, u.name, u.region_id, u.is_active,
      (select count(*)::int from core.employees e
        where e.unit_id = u.id and e.deleted_at is null) as emp
    from core.units u
    where u.deleted_at is null
  `);

  const report = {
    linked: [] as Array<Record<string, unknown>>,
    deactivated: [] as Array<Record<string, unknown>>,
    notFoundActive: [] as string[],
    notFoundDeactivated: [] as string[],
  };

  // --- Ativas: vincular regional ---
  for (const [officialName, regionCode] of ACTIVE) {
    const targetRegionId = regionIds.get(regionCode)!;
    const regionName = REGION_META[regionCode].name;
    const candidates = allUnits.rows.filter((u) => namesMatch(u.name, officialName));
    if (!candidates.length) {
      report.notFoundActive.push(officialName);
      continue;
    }

    const onTarget = candidates.find((u) => u.region_id === targetRegionId);
    const canonical =
      onTarget ||
      [...candidates].sort((a, b) => b.emp - a.emp || a.name.localeCompare(b.name))[0];

    if (canonical.region_id !== targetRegionId) {
      const conflict = await client.query<{ id: string }>(
        `select id from core.units
         where deleted_at is null
           and region_id = $1
           and id <> $2
           and upper(translate(name,
             'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
             'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC'))
             = upper(translate($3,
             'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
             'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC'))
         limit 1`,
        [targetRegionId, canonical.id, canonical.name],
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
           set unit_id = $1, region_id = $2, region_name_snapshot = $3, updated_at = now()
           where unit_id = $4 and deleted_at is null`,
          [keepId, targetRegionId, regionName, canonical.id],
        );
        await client.query(
          `update core.units set deleted_at = now(), is_active = false, updated_at = now() where id = $1`,
          [canonical.id],
        );
        report.linked.push({
          officialName,
          regionCode,
          status: "MERGED",
          into: keepId,
        });
        continue;
      }

      await client.query(
        `update core.units set region_id = $2, is_active = true, updated_at = now() where id = $1`,
        [canonical.id, targetRegionId],
      );
    } else {
      await client.query(
        `update core.units set is_active = true, updated_at = now() where id = $1 and is_active = false`,
        [canonical.id],
      );
    }

    for (const dup of candidates) {
      if (dup.id === canonical.id) continue;
      await client.query(
        `update core.employees set unit_id = $1, region_id = $2, updated_at = now()
         where unit_id = $3 and deleted_at is null`,
        [canonical.id, targetRegionId, dup.id],
      );
      await client.query(
        `update occupational.aso_monthly_plans
         set unit_id = $1, region_id = $2, region_name_snapshot = $3, updated_at = now()
         where unit_id = $4 and deleted_at is null`,
        [canonical.id, targetRegionId, regionName, dup.id],
      );
      await client.query(
        `update core.units set deleted_at = now(), is_active = false, updated_at = now() where id = $1`,
        [dup.id],
      );
    }

    const emp = await client.query(
      `update core.employees
       set region_id = $2, updated_at = now()
       where unit_id = $1 and deleted_at is null and (region_id is distinct from $2)`,
      [canonical.id, targetRegionId],
    );
    const plans = await client.query(
      `update occupational.aso_monthly_plans
       set region_id = $2, region_name_snapshot = $3, updated_at = now()
       where unit_id = $1 and deleted_at is null
         and (region_id is distinct from $2 or region_name_snapshot is distinct from $3)`,
      [canonical.id, targetRegionId, regionName],
    );

    report.linked.push({
      officialName,
      regionCode,
      status: "UPDATED",
      unit: canonical.name,
      employeesRelinked: emp.rowCount ?? 0,
      plansUpdated: plans.rowCount ?? 0,
      duplicatesMerged: candidates.length - 1,
    });
  }

  // --- Desativadas: is_active = false (mantém histórico; não aparece como regional oficial) ---
  for (const officialName of DEACTIVATED) {
    const candidates = allUnits.rows.filter((u) => namesMatch(u.name, officialName));
    if (!candidates.length) {
      report.notFoundDeactivated.push(officialName);
      continue;
    }
    for (const u of candidates) {
      await client.query(
        `update core.units
         set is_active = false, updated_at = now()
         where id = $1`,
        [u.id],
      );
      report.deactivated.push({
        name: u.name,
        id: u.id,
        emp: u.emp,
      });
    }
  }

  const remaining = await client.query(`
    select count(*)::int as n
    from core.units u
    left join core.regions r on r.id = u.region_id
    where u.deleted_at is null
      and u.is_active = true
      and (
        u.region_id is null
        or upper(coalesce(r.code, '')) in ('NAO_INFORMADA', 'NAO_INFORMADO', '')
      )
  `);

  console.log(
    JSON.stringify(
      {
        linkedCount: report.linked.length,
        deactivatedCount: report.deactivated.length,
        notFoundActive: report.notFoundActive,
        notFoundDeactivated: report.notFoundDeactivated,
        stillUnmappedActive: remaining.rows[0]?.n ?? 0,
        sampleLinked: report.linked.slice(0, 15),
        sampleDeactivated: report.deactivated.slice(0, 10),
      },
      null,
      2,
    ),
  );

  await client.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
