/**
 * Sync rápida do espelho (pg direto, matrícula = chave).
 * CPF duplicado não bloqueia — matrícula prevalece.
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { createCipheriv, createHash as cryptoHash, randomBytes } from "node:crypto";
import { Client } from "pg";

config({ path: resolve(process.cwd(), ".env.local") });

const SHEET_ID = process.env.ALTERDATA_MIRROR_SHEET_ID?.trim();
if (!SHEET_ID) {
  console.error("Defina ALTERDATA_MIRROR_SHEET_ID no .env.local");
  process.exit(1);
}
const GID = process.env.ALTERDATA_MIRROR_GID || "0";

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCpf(cpf: string) {
  return cpf.replace(/\D/g, "");
}

function hashCpf(cpf: string) {
  return cryptoHash("sha256").update(normalizeCpf(cpf)).digest("hex");
}

function encryptField(plain: string): string | null {
  const keyEnv = process.env.FIELD_ENCRYPTION_KEY;
  if (!keyEnv) return null;
  const key = cryptoHash("sha256").update(keyEnv).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else field += ch;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      current.push(field);
      field = "";
      continue;
    }
    if (ch === "\n") {
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
      continue;
    }
    if (ch === "\r") continue;
    field += ch;
  }
  if (field.length || current.length) {
    current.push(field);
    rows.push(current);
  }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cols) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] ?? "").trim();
    });
    return obj;
  });
}

function cell(row: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const found = Object.keys(row).find(
      (k) => normalizeText(k) === normalizeText(key),
    );
    if (found && row[found]) return row[found].trim();
  }
  return "";
}

function toDate(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  const br = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return null;
}

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  console.log("Baixando espelho...");
  const csvRes = await fetch(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`,
    { cache: "no-store" },
  );
  if (!csvRes.ok) throw new Error(`HTTP ${csvRes.status} no espelho`);
  const csv = await csvRes.text();
  const rows = parseCsv(csv);
  console.log("Linhas no espelho:", rows.length);

  const c = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  await c.query(`update files.import_batches set status='CANCELLED' where status='RUNNING'`);

  const existingRegs = await c.query<{
    id: string;
    registration: string;
    cpf_hash: string | null;
  }>(`select id, registration, cpf_hash from core.employees where deleted_at is null`);
  const byReg = new Map(existingRegs.rows.map((r) => [r.registration, r]));

  const cpfOwners = new Map<string, string>();
  for (const r of existingRegs.rows) {
    if (r.cpf_hash) cpfOwners.set(r.cpf_hash, r.registration);
  }

  const regionCache = new Map<string, string>();
  const unitCache = new Map<string, string>();
  const roleCache = new Map<string, string>();

  async function ensureRegion(name: string) {
    const code = normalizeText(name || "NAO_INFORMADA");
    const fixed = code === "CENTRO" ? "CENTRAL" : code;
    if (regionCache.has(fixed)) return regionCache.get(fixed)!;
    const found = await c.query(`select id from core.regions where code=$1 limit 1`, [fixed]);
    if (found.rows[0]) {
      regionCache.set(fixed, found.rows[0].id);
      return found.rows[0].id as string;
    }
    const ins = await c.query(
      `insert into core.regions (code, name) values ($1,$2) returning id`,
      [fixed, name || fixed],
    );
    regionCache.set(fixed, ins.rows[0].id);
    return ins.rows[0].id as string;
  }

  async function ensureUnit(regionId: string, name: string, city: string) {
    const key = `${regionId}::${normalizeText(name)}`;
    if (unitCache.has(key)) return unitCache.get(key)!;
    const found = await c.query(
      `select id from core.units where region_id=$1 and name=$2 and deleted_at is null limit 1`,
      [regionId, name],
    );
    if (found.rows[0]) {
      unitCache.set(key, found.rows[0].id);
      return found.rows[0].id as string;
    }
    const ins = await c.query(
      `insert into core.units (region_id, name, city) values ($1,$2,$3) returning id`,
      [regionId, name, city || null],
    );
    unitCache.set(key, ins.rows[0].id);
    return ins.rows[0].id as string;
  }

  async function ensureRole(name: string) {
    if (!name) return null;
    const normalized = normalizeText(name);
    if (roleCache.has(normalized)) return roleCache.get(normalized)!;
    const found = await c.query(
      `select id from core.job_roles where normalized_name=$1 limit 1`,
      [normalized],
    );
    if (found.rows[0]) {
      roleCache.set(normalized, found.rows[0].id);
      return found.rows[0].id as string;
    }
    const ins = await c.query(
      `insert into core.job_roles (name, normalized_name) values ($1,$2) returning id`,
      [name, normalized],
    );
    roleCache.set(normalized, ins.rows[0].id);
    return ins.rows[0].id as string;
  }

  const batch = await c.query(
    `insert into files.import_batches (source_name, status, total_rows)
     values ($1,'RUNNING',$2) returning id`,
    [`mirror-fast:${SHEET_ID}`, rows.length],
  );
  const batchId = batch.rows[0].id as string;

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const seenCpf = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const fullName = cell(row, "NmFuncionario", "Nome do Funcionário");
      const registration = cell(row, "CdChamada", "Matrícula", "Funcionário");
      if (!fullName || !registration) {
        skipped++;
        continue;
      }

      const department = cell(row, "nmdepartamento", "Departamento");
      const city = cell(row, "nmcidade", "cidade");
      const roleName = cell(row, "nmfuncao", "Função");
      const demissao = cell(row, "DtDemissao");
      const statusAso = cell(row, "Status_ASO");
      const functionalStatus =
        demissao || normalizeText(statusAso).includes("DEMIT")
          ? "DEMITIDO"
          : "ATIVO";

      const regionId = await ensureRegion(cell(row, "Regional") || "NAO_INFORMADA");
      const unitId = department ? await ensureUnit(regionId, department, city) : null;
      const jobRoleId = await ensureRole(roleName);

      const cpfRaw = cell(row, "NrCPF", "CPF");
      let cpfHash: string | null = null;
      let cpfEncrypted: string | null = null;
      if (cpfRaw) {
        const digits = normalizeCpf(cpfRaw);
        if (digits.length === 11) {
          const h = hashCpf(digits);
          const owner = cpfOwners.get(h);
          if (!seenCpf.has(h) && (!owner || owner === registration)) {
            cpfHash = h;
            seenCpf.add(h);
            cpfOwners.set(h, registration);
            cpfEncrypted = encryptField(digits);
          }
        }
      }

      const existing = byReg.get(registration);
      if (existing) {
        await c.query(
          `update core.employees set
            full_name=$1, normalized_name=$2, city=$3, phone=$4, sex=$5,
            admission_date=$6, dismissal_date=$7, birth_date=$8,
            functional_status=$9, job_role_id=$10, unit_id=$11, region_id=$12,
            cpf_hash=coalesce($13, cpf_hash), cpf_encrypted=coalesce($14, cpf_encrypted),
            source_system='ALTERDATA_MIRROR', alterdata_id=$15, updated_at=now()
           where id=$16`,
          [
            fullName,
            normalizeText(fullName),
            city || null,
            cell(row, "NrTelefone", "NrCelular") || null,
            cell(row, "TpSexo") || null,
            toDate(cell(row, "DtAdmissao")),
            toDate(demissao),
            toDate(cell(row, "DtNascimento")),
            functionalStatus,
            jobRoleId,
            unitId,
            regionId,
            cpfHash,
            cpfEncrypted,
            registration,
            existing.id,
          ],
        );
        updated++;
      } else {
        const ins = await c.query(
          `insert into core.employees (
            registration, full_name, normalized_name, city, phone, sex,
            admission_date, dismissal_date, birth_date, functional_status,
            job_role_id, unit_id, region_id, cpf_hash, cpf_encrypted,
            source_system, alterdata_id
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'ALTERDATA_MIRROR',$16)
          returning id`,
          [
            registration,
            fullName,
            normalizeText(fullName),
            city || null,
            cell(row, "NrTelefone", "NrCelular") || null,
            cell(row, "TpSexo") || null,
            toDate(cell(row, "DtAdmissao")),
            toDate(demissao),
            toDate(cell(row, "DtNascimento")),
            functionalStatus,
            jobRoleId,
            unitId,
            regionId,
            cpfHash,
            cpfEncrypted,
            registration,
          ],
        );
        byReg.set(registration, {
          id: ins.rows[0].id,
          registration,
          cpf_hash: cpfHash,
        });
        imported++;
      }

      if ((i + 1) % 1000 === 0) {
        console.log(`progress ${i + 1}/${rows.length} imported=${imported} updated=${updated}`);
      }
    } catch (e) {
      errors++;
      await c.query(
        `insert into files.import_errors (batch_id, row_number, message) values ($1,$2,$3)`,
        [batchId, i + 2, e instanceof Error ? e.message : String(e)],
      );
    }
  }

  await c.query(
    `update files.import_batches set
      status=$1, imported_rows=$2, updated_rows=$3, skipped_rows=$4, error_rows=$5,
      report_summary=$6
     where id=$7`,
    [
      errors ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
      imported,
      updated,
      skipped,
      errors,
      JSON.stringify({
        fileHash: createHash("sha256").update(csv).digest("hex"),
        mode: "FAST_PG_READONLY",
      }),
      batchId,
    ],
  );

  const total = await c.query(
    `select count(*)::int n from core.employees where deleted_at is null`,
  );
  console.log({
    mirrorRows: rows.length,
    imported,
    updated,
    skipped,
    errors,
    employeesInDb: total.rows[0].n,
  });
  await c.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
