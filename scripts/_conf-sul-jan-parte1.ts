/**
 * Parte 1 — Conferência Sul / Periódico / Jan 2026
 * Compara: planilha ALTERDATA × planos no banco
 */
import { config } from "dotenv";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { Client } from "pg";

config({ path: resolve(process.cwd(), ".env.local") });

function normalizeText(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cell(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const found = Object.keys(row).find(
      (k) => normalizeText(k) === normalizeText(key),
    );
    if (found && row[found] != null && String(row[found]).trim() !== "") {
      return row[found];
    }
  }
  return "";
}

function excelDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    if (value < 20000 || value > 60000) return null;
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const raw = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(raw)) return excelDate(Number(raw));
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return null;
}

function regKey(v: unknown): string {
  const digits = String(v ?? "").replace(/\D/g, "");
  return digits.replace(/^0+/, "") || "0";
}

function isSul(raw: string): boolean {
  const n = normalizeText(raw);
  return n === "SUL" || n === "OESTE" || n.includes("SUL");
}

async function main() {
  const file =
    readdirSync(process.cwd()).find((f) =>
      /^Planilha Sistema.*\.xlsx$/i.test(f),
    ) || "Planilha Sistema Saúde.xlsx";
  if (!existsSync(file)) throw new Error("Planilha não encontrada");

  const wb = XLSX.readFile(file);
  const alt = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets["ALTERDATA"],
    { defval: "" },
  );

  // Headers sample for Regional column name
  const headers = Object.keys(alt[0] || {});
  const regionalHeader = headers.find((h) =>
    normalizeText(h).includes("REGIONAL"),
  );
  console.log("COLUNA_REGIONAL", regionalHeader || "(não achou — listando headers relevantes)");
  console.log(
    "HEADERS_SAMPLE",
    headers.filter((h) =>
      /reg|depart|proximo|atest|period|chamada|nome/i.test(h),
    ),
  );

  type SheetRow = {
    reg: string;
    name: string;
    next: string | null;
    last: string | null;
    regional: string;
    dept: string;
    demissao: string | null;
  };

  const sheetJan: SheetRow[] = [];
  for (const row of alt) {
    const next = excelDate(cell(row, "Proximo_aso", "Próximo ASO"));
    if (!next || !next.startsWith("2026-01-")) continue;
    const regional = String(
      cell(row, "Regional", "nmRegional", "REGIONAL") || "",
    );
    // Se não houver coluna Regional na aba ALTERDATA, não filtramos ainda
    sheetJan.push({
      reg: regKey(cell(row, "CdChamada", "Matrícula", "Funcionário")),
      name: String(cell(row, "NmFuncionario", "Nome do Funcionário") || ""),
      next,
      last: excelDate(cell(row, "Data_Atestado", "Data Atestado")),
      regional,
      dept: String(cell(row, "nmdepartamento", "Departamento") || ""),
      demissao: excelDate(cell(row, "DtDemissao", "Demissão")),
    });
  }

  const sheetSul = sheetJan.filter((r) => !r.regional || isSul(r.regional));
  const sheetComRegional = sheetJan.filter((r) => r.regional);
  const sheetSemRegional = sheetJan.filter((r) => !r.regional);

  console.log(
    JSON.stringify(
      {
        parte: 1,
        fonte: "Planilha ALTERDATA · Proximo_aso em jan/2026",
        totalJanProximoAso: sheetJan.length,
        comColunaRegional: sheetComRegional.length,
        semColunaRegional: sheetSemRegional.length,
        filtradoSulPelaColuna: sheetJan.filter((r) => isSul(r.regional)).length,
        amostraRegionais: [...new Set(sheetJan.map((r) => r.regional || "(vazio)"))].slice(
          0,
          20,
        ),
      },
      null,
      2,
    ),
  );

  const c = new Client({
    connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const db = await c.query(`
    select
      regexp_replace(p.registration, '^0+', '') as reg,
      p.registration,
      p.employee_name,
      p.expected_date::text,
      p.execution_status,
      p.eligibility,
      p.prediction_origin,
      p.region_name_snapshot,
      r.code as region_code,
      u.name as unit_name
    from occupational.aso_monthly_plans p
    left join core.regions r on r.id = p.region_id
    left join core.units u on u.id = p.unit_id
    where p.deleted_at is null
      and p.aso_type = 'PERIODICO'
      and p.year = 2026 and p.month = 1
      and r.code = 'SUL'
    order by p.employee_name
  `);

  const dbByReg = new Map(db.rows.map((r) => [r.reg, r]));

  // Se ALTERDATA não tem Regional, cruzar dept → unit → region no banco
  const units = await c.query(`
    select u.name, r.code
    from core.units u
    join core.regions r on r.id = u.region_id
    where u.deleted_at is null
  `);
  const unitRegion = new Map(
    units.rows.map((u) => [normalizeText(u.name), u.code as string]),
  );

  const sheetJanSulByUnit: SheetRow[] = [];
  for (const s of sheetJan) {
    if (s.regional && isSul(s.regional)) {
      sheetJanSulByUnit.push(s);
      continue;
    }
    if (!s.regional && s.dept) {
      const code = unitRegion.get(normalizeText(s.dept));
      if (code === "SUL") sheetJanSulByUnit.push(s);
    }
  }

  const sheetRegs = new Set(sheetJanSulByUnit.map((s) => s.reg));
  const dbRegs = new Set(db.rows.map((r) => r.reg as string));

  const soNoDb = db.rows.filter((r) => !sheetRegs.has(r.reg));
  const soNaPlanilha = sheetJanSulByUnit.filter((s) => !dbRegs.has(s.reg));
  const emAmbos = sheetJanSulByUnit.filter((s) => dbRegs.has(s.reg));

  console.log(
    JSON.stringify(
      {
        parte: "1b",
        planilhaJanSulViaUnidade: sheetJanSulByUnit.length,
        bancoPlanosSulJan: db.rows.length,
        emAmbos: emAmbos.length,
        soNoBanco: soNoDb.length,
        soNaPlanilha: soNaPlanilha.length,
      },
      null,
      2,
    ),
  );

  console.log("\n=== SÓ NO BANCO (não tem Proximo_aso jan/2026 Sul na planilha) — amostra 25 ===");
  for (const r of soNoDb.slice(0, 25)) {
    console.log(
      `${r.registration} | ${r.employee_name} | expected ${r.expected_date} | origin ${r.prediction_origin} | ${r.unit_name}`,
    );
  }

  console.log("\n=== SÓ NA PLANILHA (Proximo_aso jan Sul, sem plano PERIODICO jan Sul) — amostra 25 ===");
  for (const s of soNaPlanilha.slice(0, 25)) {
    // where did the employee go in DB?
    const emp = await c.query(
      `select e.registration, e.full_name,
              (select code from core.regions r where r.id = e.region_id) as region,
              (select name from core.units u where u.id = e.unit_id) as unit
       from core.employees e
       where deleted_at is null
         and regexp_replace(registration, '^0+', '') = $1
       limit 1`,
      [s.reg],
    );
    const planAny = await c.query(
      `select year, month, expected_date::text, region_name_snapshot, prediction_origin
       from occupational.aso_monthly_plans
       where deleted_at is null and aso_type='PERIODICO'
         and regexp_replace(registration, '^0+', '') = $1
         and year=2026
       order by month`,
      [s.reg],
    );
    console.log(
      `${s.reg} | ${s.name} | next ${s.next} | dept ${s.dept} | empDB ${JSON.stringify(emp.rows[0] || null)} | planos2026 ${JSON.stringify(planAny.rows)}`,
    );
  }

  // Origins breakdown in DB
  const origins = await c.query(`
    select prediction_origin, count(*)::int n
    from occupational.aso_monthly_plans p
    join core.regions r on r.id = p.region_id
    where p.deleted_at is null and p.aso_type='PERIODICO'
      and p.year=2026 and p.month=1 and r.code='SUL'
    group by 1 order by 2 desc
  `);
  console.log("\nORIGENS_NO_BANCO", origins.rows);

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
