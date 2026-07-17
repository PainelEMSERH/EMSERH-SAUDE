/**
 * Parte 1c — Dos 72 "só no banco", o que diz o espelho/planilha?
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
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function regKey(v: unknown): string {
  const digits = String(v ?? "").replace(/\D/g, "");
  return digits.replace(/^0+/, "") || "0";
}

async function main() {
  const file =
    readdirSync(process.cwd()).find((f) =>
      /^Planilha Sistema.*\.xlsx$/i.test(f),
    ) || "Planilha Sistema Saúde.xlsx";
  const wb = XLSX.readFile(file);
  const alt = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets["ALTERDATA"],
    { defval: "" },
  );
  const sheetByReg = new Map<
    string,
    { next: string | null; last: string | null; dept: string; name: string }
  >();
  for (const row of alt) {
    const reg = regKey(cell(row, "CdChamada", "Matrícula"));
    sheetByReg.set(reg, {
      name: String(cell(row, "NmFuncionario", "Nome") || ""),
      next: excelDate(cell(row, "Proximo_aso")),
      last: excelDate(cell(row, "Data_Atestado")),
      dept: String(cell(row, "nmdepartamento") || ""),
    });
  }

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
      p.expected_date::text as expected,
      p.prediction_origin,
      p.eligibility,
      p.execution_status,
      u.name as unit_name,
      m.next_aso_date::text as mirror_next,
      m.last_aso_date::text as mirror_last,
      m.synced_at::text as mirror_synced
    from occupational.aso_monthly_plans p
    join core.regions r on r.id = p.region_id
    left join core.units u on u.id = p.unit_id
    left join lateral (
      select s.next_aso_date, s.last_aso_date, s.synced_at
      from occupational.aso_alterdata_snapshots s
      where regexp_replace(s.registration, '^0+', '') = regexp_replace(p.registration, '^0+', '')
      order by s.synced_at desc
      limit 1
    ) m on true
    where p.deleted_at is null
      and p.aso_type = 'PERIODICO'
      and p.year = 2026 and p.month = 1
      and r.code = 'SUL'
    order by p.prediction_origin, p.employee_name
  `);

  // sheet jan sul via unit
  const units = await c.query(`
    select u.name, r.code from core.units u
    join core.regions r on r.id = u.region_id
    where u.deleted_at is null
  `);
  const unitRegion = new Map(
    units.rows.map((u) => [normalizeText(u.name), u.code as string]),
  );

  const sheetJanSulRegs = new Set<string>();
  for (const [reg, s] of sheetByReg) {
    if (!s.next?.startsWith("2026-01-")) continue;
    const code = unitRegion.get(normalizeText(s.dept));
    if (code === "SUL") sheetJanSulRegs.add(reg);
  }

  const onlyDb = db.rows.filter((r) => !sheetJanSulRegs.has(r.reg));

  type Bucket = {
    key: string;
    n: number;
    samples: string[];
  };
  const buckets = new Map<string, Bucket>();

  function bump(key: string, sample: string) {
    const b = buckets.get(key) || { key, n: 0, samples: [] };
    b.n++;
    if (b.samples.length < 5) b.samples.push(sample);
    buckets.set(key, b);
  }

  for (const r of onlyDb) {
    const sheet = sheetByReg.get(r.reg);
    const sheetNext = sheet?.next || null;
    const mirrorNext = r.mirror_next || null;
    const expected = r.expected;

    let key: string;
    if (!sheet) {
      key = `sem_linha_planilha · origin=${r.prediction_origin}`;
    } else if (sheetNext === expected) {
      key = `planilha_bate_expected_mas_unidade_nao_sul? · origin=${r.prediction_origin}`;
    } else if (mirrorNext === expected && sheetNext !== expected) {
      key = `espelho_bate_expected_planilha_diferente · origin=${r.prediction_origin}`;
    } else if (mirrorNext?.startsWith("2026-01-") && !sheetNext?.startsWith("2026-01-")) {
      key = `espelho_jan_planilha_outro_mes · origin=${r.prediction_origin}`;
    } else if (!sheetNext?.startsWith("2026-01-") && !mirrorNext?.startsWith("2026-01-")) {
      key = `nem_planilha_nem_espelho_sao_jan · origin=${r.prediction_origin} · sheet=${sheetNext || "null"} · mirror=${mirrorNext || "null"}`;
    } else if (sheetNext?.startsWith("2026-01-") && unitRegion.get(normalizeText(sheet.dept || "")) !== "SUL") {
      key = `planilha_jan_mas_dept_nao_sul · dept=${sheet.dept}`;
    } else {
      key = `outros · sheet=${sheetNext} · mirror=${mirrorNext} · expected=${expected} · origin=${r.prediction_origin}`;
    }

    bump(
      key,
      `${r.registration} ${r.employee_name} | exp ${expected} | sheet ${sheetNext} | mirror ${mirrorNext} | ${r.unit_name}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        onlyDb: onlyDb.length,
        buckets: [...buckets.values()].sort((a, b) => b.n - a.n),
      },
      null,
      2,
    ),
  );

  // Distribution of sheet next month for onlyDb
  const monthDist = new Map<string, number>();
  for (const r of onlyDb) {
    const sheet = sheetByReg.get(r.reg);
    const m = sheet?.next?.slice(0, 7) || "(sem)";
    monthDist.set(m, (monthDist.get(m) || 0) + 1);
  }
  console.log("\nMeses do Proximo_aso na PLANILHA (dos só-no-banco):");
  console.log(
    [...monthDist.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n"),
  );

  const mirrorMonthDist = new Map<string, number>();
  for (const r of onlyDb) {
    const m = (r.mirror_next as string | null)?.slice(0, 7) || "(sem)";
    mirrorMonthDist.set(m, (mirrorMonthDist.get(m) || 0) + 1);
  }
  console.log("\nMeses do next no ESPELHO (dos só-no-banco):");
  console.log(
    [...mirrorMonthDist.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n"),
  );

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
