/**
 * Cruza lista oficial Departamento;Regional com o banco.
 * Uso: npx tsx scripts/audit-unit-regions.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { Client } from "pg";

config({ path: resolve(process.cwd(), ".env.local") });

const OFFICIAL: Array<[string, string]> = [
  ["HOSPITAL REGIONAL DE BARRA DO CORDA", "CENTRO"],
  ["HOSPITAL GERAL DE GRAJAU", "CENTRO"],
  ["HOSPITAL PRESIDENTE DUTRA", "CENTRO"],
  ["HOSPITAL DE PEDREIRAS", "CENTRO"],
  ["UPA SAO JOAO DOS PATOS", "CENTRO"],
  ["AGENCIA TRANSFUSIONAL COLINAS", "CENTRO"],
  ["POLICLINICA BARRA DO CORDA", "CENTRO"],
  ["HEMONUCLEO DE PEDREIRAS", "CENTRO"],
  ["HOSPITAL REGIONAL DE LAGO DA PEDRA", "CENTRO"],
  ["HEMONUCLEO DE BACABAL", "CENTRO"],
  ["AGENCIA TRANSFUSIONAL DE SÃO JOÃO DOS PATOS", "CENTRO"],
  ["AGENCIA TRANSFUSIONAL BARRA DO CORDA", "CENTRO"],
  ["CENTRO DE HEMODIALISE - BARRA DO CORDA", "CENTRO"],
  ["HOSPITAL REGIONAL ALARICO NUNES PACHECO - Timon", "LESTE"],
  ["HOSPITAL MACROREGIONAL DE CAXIAS", "LESTE"],
  ["HOSPITAL ADELIA MATOS FONSECA", "LESTE"],
  ["HOSPITAL GERAL DE ALTO ALEGRE", "LESTE"],
  ["HOSPITAL GERAL DE PERITORO", "LESTE"],
  ["UPA CODO", "LESTE"],
  ["UPA TIMON", "LESTE"],
  ["HOSPITAL MACROREGIONAL DE COROATA", "LESTE"],
  ["HEMONUCLEO DE CAXIAS", "LESTE"],
  ["UPA COROATA", "LESTE"],
  ["HOSPITAL REGIONAL DE TIMBIRAS", "LESTE"],
  ["POLICLINICA DE CODÓ", "LESTE"],
  ["POLICLINICA CAXIAS", "LESTE"],
  ["HOSPITAL REGIONAL DE CHAPADINHA", "LESTE"],
  ["POLICLINICA DE MATOES DO NORTE", "LESTE"],
  ["HEMONUCLEO DE CODO", "LESTE"],
  ["SVO -SERV. VERIFICAÇÃO DE ÓBITOS - TIMON", "LESTE"],
  ["FEME PROGRAMA DO LEITE", "LESTE"],
  ["AGENCIA TRANSFUSIONAL CHAPADINHA", "LESTE"],
  ["FEME DE CAXIAS", "LESTE"],
  ["AGENCIA TRANSFUSIONAL TIMON", "LESTE"],
  ["HOSPITAL PRESIDENTE VARGAS", "NORTE"],
  ["HOSPITAL VILA LUIZAO", "NORTE"],
  ["HOSPITAL GENESIO REGO", "NORTE"],
  ["HEMOMAR", "NORTE"],
  ["EMSERH SEDE", "NORTE"],
  ["POLICLINICA DO CUJUPE", "NORTE"],
  ["CENTRO ESPECIALIDADES MEDICAS PAM DIAMANTE", "NORTE"],
  ["HOSPITAL DA ILHA", "NORTE"],
  ["UPA PAÇO DO LUMIAR", "NORTE"],
  ["POLICLINICA COHATRAC", "NORTE"],
  ["CAF - SEDE EMSERH", "NORTE"],
  ["SOLAR DO OUTONO", "NORTE"],
  ["UPA PARQUE VITORIA", "NORTE"],
  ["CENTRAL DE REGULACAO - TRANSPORTE", "NORTE"],
  ["LACEN", "NORTE"],
  ["POLICLINICA VINHAIS", "NORTE"],
  ["FESMA", "NORTE"],
  ["UPA CIDADE OPERARIA", "NORTE"],
  ["CAF - FEME", "NORTE"],
  ["FEME - UGAF", "NORTE"],
  ["FEME", "NORTE"],
  ["HOSPITAL DE CUIDADOS INTENSIVOS - HCI", "NORTE"],
  ["HEMONUCLEO PINHEIRO", "NORTE"],
  ["HOSPITAL REGIONAL DE MORROS", "NORTE"],
  ["AGENCIA TRANSFUSIONAL DE CURURUPU", "NORTE"],
  ["UPA ITAQUI BACANGA", "NORTE"],
  ["UPA ARACAGY", "NORTE"],
  ["TEA - CENTRO ESPECIALIZADO DE REAB. OLHO D AGUA", "NORTE"],
  ["CENTRO ESPECIALIZADO DE REABILITACAO OLHO D AGUA", "NORTE"],
  ["CENTRAL DE REGULACAO - LEITOS", "NORTE"],
  ["CENTRO DE SAUDE GENESIO REGO", "NORTE"],
  ["POLICLINICA VILA LUIZAO", "NORTE"],
  ["CENTRO DE TERAPIA RENAL SUBSTITUTIVA", "NORTE"],
  ["UPA VINHAIS", "NORTE"],
  ["EMSERH SEDE DIRETORIA", "NORTE"],
  ["POLICLINICA CIDADE OPERARIA", "NORTE"],
  ["HOSPITAL DE PAULINO NEVES", "NORTE"],
  ["CENTRAL DE REGULACAO - AMBULATORIAL", "NORTE"],
  ["CENTRO ESPECIALIZADO DE REAB. CIDADE OPERARIA", "NORTE"],
  ["POLICLINICA DO COROADINHO", "NORTE"],
  ["CASA TEA 12+", "NORTE"],
  ["HOSPITAL REGIONAL SANTA LUZIA DO PARUA", "NORTE"],
  ["HOSPITAL AQUILES LISBOA", "NORTE"],
  ["HOSPITAL DE BARREIRINHAS", "NORTE"],
  ["HOSPITAL REGIONAL DE CARUTAPERA", "NORTE"],
  ["PROJETO GIRASSOL", "NORTE"],
  ["SVO -SERV. VERIFICAÇÃO DE ÓBITOS - SÃO LUÍS", "NORTE"],
  ["SHOPPING DA CRIANÇA", "NORTE"],
  ["AGENCIA TRANSFUSIONAL DE VIANA", "NORTE"],
  ["RESIDENCIA MEDICA E MULTI - ANALISTAS TECNICOS", "NORTE"],
  ["PROGRAMA DE ACAO INTEGRADA PARA APOSENTADOS - PAI", "NORTE"],
  ["CENTRAL DE REGULAÇÃO -TRATAMENTO FORA DO DOMICILIO", "NORTE"],
  ["NUCLEO DE GESTAO DA REGULACAO - NGR", "NORTE"],
  ["TEA - CIDADE OPERARIA", "NORTE"],
  ["CENTRO DE HEMODIALISE - SANTA LUZIA DO PARUA", "NORTE"],
  ["HOSPITAL MATERNO INFANTIL IMPERATRIZ", "SUL"],
  ["UPA DE IMPERATRIZ", "SUL"],
  ["HEMONUCLEO SANTA INES", "SUL"],
  ["CASA DA GESTANTE, BEBE E PUERPERA", "SUL"],
  ["CENTRO DA PESSOA IDOSA", "SUL"],
  ["POLICLINICA AÇAILANDIA", "SUL"],
  ["HEMONUCLEO DE IMPERATRIZ", "SUL"],
  ["HEMONUCLEO DE BALSAS", "SUL"],
  ["HOSPITAL E MATERNIDADE ADERSON MARINHO - P. FRANCO", "SUL"],
  ["FEME IMPERATRIZ", "SUL"],
  ["HOSPITAL MACRORREGIONAL DRA RUTH NOLETO", "SUL"],
  ["SVO -SERV.VERIFICAÇÃO DE ÓBITOS - IMPERATRIZ", "SUL"],
  ["POLICLINICA DE IMPERATRIZ", "SUL"],
  ["LACEN IMPERATRIZ", "SUL"],
  ["CENTRAL DE REGULACAO - MACRO SUL", "SUL"],
  ["AGENCIA TRANSFUSIONAL PORTO FRANCO", "SUL"],
];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[–—−]/g, "-")
    .replace(/\u00a0/g, " ")
    .trim();
}

function normalizeRegion(value: string) {
  const n = normalizeText(value);
  if (n === "CENTRAL" || n === "CENTRO") return "CENTRO";
  if (n === "OESTE") return "SUL";
  return n;
}

function scoreMatch(a: string, b: string) {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    return Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
  }
  return 0;
}

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const units = await client.query<{
    id: string;
    name: string;
    region_code: string | null;
    is_active: boolean;
    emp: number;
  }>(`
    select u.id, u.name, r.code as region_code, u.is_active,
      (select count(*)::int from core.employees e
        where e.unit_id = u.id and e.deleted_at is null) as emp
    from core.units u
    left join core.regions r on r.id = u.region_id and r.deleted_at is null
    where u.deleted_at is null
    order by u.name
  `);

  const ok: string[] = [];
  const wrongRegion: Array<Record<string, unknown>> = [];
  const missingInDb: Array<Record<string, unknown>> = [];
  const inactiveButListed: Array<Record<string, unknown>> = [];
  const matchedIds = new Set<string>();

  for (const [name, regionRaw] of OFFICIAL) {
    const want = normalizeRegion(regionRaw);
    let best: (typeof units.rows)[0] | null = null;
    let bestScore = 0;
    for (const u of units.rows) {
      const s = scoreMatch(u.name, name);
      if (s > bestScore) {
        bestScore = s;
        best = u;
      }
    }

    if (!best || bestScore < 0.85) {
      missingInDb.push({ official: name, want, bestScore, best: best?.name });
      continue;
    }

    matchedIds.add(best.id);
    const got = normalizeRegion(best.region_code || "NAO_INFORMADA");

    if (!best.is_active) {
      inactiveButListed.push({
        official: name,
        db: best.name,
        want,
        got,
        emp: best.emp,
      });
    }

    if (got !== want) {
      wrongRegion.push({
        official: name,
        db: best.name,
        want,
        got,
        active: best.is_active,
        emp: best.emp,
      });
    } else {
      ok.push(`${best.name} → ${got}`);
    }
  }

  // Ativas no banco com regional inválida e não cobertas pela lista
  const unmappedActive = units.rows.filter((u) => {
    if (!u.is_active) return false;
    const code = normalizeRegion(u.region_code || "");
    return !code || code === "NAO_INFORMADA" || code === "NAO_INFORMADO";
  });

  // Ativas no banco fora da lista oficial (com regional ok)
  const extraActive = units.rows.filter((u) => {
    if (!u.is_active) return false;
    if (matchedIds.has(u.id)) return false;
    const code = normalizeRegion(u.region_code || "");
    return code && code !== "NAO_INFORMADA";
  });

  console.log(
    JSON.stringify(
      {
        officialCount: OFFICIAL.length,
        okCount: ok.length,
        wrongRegionCount: wrongRegion.length,
        missingInDbCount: missingInDb.length,
        inactiveButListedCount: inactiveButListed.length,
        unmappedActiveCount: unmappedActive.length,
        extraActiveCount: extraActive.length,
        wrongRegion,
        missingInDb,
        inactiveButListed,
        unmappedActive: unmappedActive.map((u) => ({
          name: u.name,
          region: u.region_code,
          emp: u.emp,
        })),
        extraActiveSample: extraActive.slice(0, 40).map((u) => ({
          name: u.name,
          region: u.region_code,
          emp: u.emp,
        })),
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
