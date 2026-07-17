/**
 * Importação idempotente de colaboradores (Alterdata).
 * Uso: npm run import:employees -- --file=./planilha.xlsx --sheet="Extração Alterdata" --yes
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "../src/db/schemas";
import {
  employees,
  importBatches,
  importErrors,
  jobRoles,
  regions,
  units,
} from "../src/db/schemas";

function arg(name: string) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRegion(value: string) {
  const n = normalizeText(value);
  if (n === "CENTRO" || n === "CENTRAL") return "CENTRAL";
  return n;
}

function cell(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const found = Object.keys(row).find(
      (k) => normalizeText(k) === normalizeText(key),
    );
    if (found && row[found] != null && String(row[found]).trim() !== "") {
      return String(row[found]).trim();
    }
  }
  return "";
}

async function main() {
  const file = arg("file");
  const sheetName = arg("sheet") ?? "Extração Alterdata";
  const yes = hasFlag("yes");
  if (!file) {
    console.error(
      'Uso: npm run import:employees -- --file=./planilha.xlsx --sheet="Extração Alterdata" --yes',
    );
    process.exit(1);
  }
  if (!existsSync(file)) throw new Error(`Arquivo não encontrado: ${file}`);
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");

  const wb = XLSX.readFile(file);
  const sheet = wb.Sheets[sheetName] ?? wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("Aba não encontrada.");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  console.log(`Arquivo: ${file}`);
  console.log(`Aba: ${sheetName}`);
  console.log(`Linhas: ${rows.length}`);
  if (!yes) {
    console.log("Dry-run. Reexecute com --yes para gravar.");
    return;
  }

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const db = drizzle(client, { schema });

  const fileHash = createHash("sha256")
    .update(readFileSync(file))
    .digest("hex");

  const [batch] = await db
    .insert(importBatches)
    .values({
      sourceName: path.basename(file),
      status: "RUNNING",
      totalRows: rows.length,
    })
    .returning();

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const errorRows: Array<Record<string, unknown>> = [];

  const regionCache = new Map<string, string>();
  const unitCache = new Map<string, string>();
  const roleCache = new Map<string, string>();

  async function ensureRegion(name: string) {
    const code = normalizeRegion(name || "NAO_INFORMADA");
    if (regionCache.has(code)) return regionCache.get(code)!;
    const [existing] = await db
      .select()
      .from(regions)
      .where(eq(regions.code, code))
      .limit(1);
    if (existing) {
      regionCache.set(code, existing.id);
      return existing.id;
    }
    const [created] = await db
      .insert(regions)
      .values({ code, name: name || code })
      .returning();
    regionCache.set(code, created.id);
    return created.id;
  }

  async function ensureUnit(regionId: string, name: string, city: string) {
    const key = `${regionId}::${normalizeText(name)}`;
    if (unitCache.has(key)) return unitCache.get(key)!;
    const [existing] = await db
      .select()
      .from(units)
      .where(and(eq(units.regionId, regionId), eq(units.name, name)))
      .limit(1);
    if (existing) {
      unitCache.set(key, existing.id);
      return existing.id;
    }
    const [created] = await db
      .insert(units)
      .values({ regionId, name, city: city || null })
      .returning();
    unitCache.set(key, created.id);
    return created.id;
  }

  async function ensureRole(name: string) {
    if (!name) return null;
    const normalized = normalizeText(name);
    if (roleCache.has(normalized)) return roleCache.get(normalized)!;
    const [existing] = await db
      .select()
      .from(jobRoles)
      .where(eq(jobRoles.normalizedName, normalized))
      .limit(1);
    if (existing) {
      roleCache.set(normalized, existing.id);
      return existing.id;
    }
    const [created] = await db
      .insert(jobRoles)
      .values({ name, normalizedName: normalized })
      .returning();
    roleCache.set(normalized, created.id);
    return created.id;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const fullName = cell(row, "NmFuncionario", "Nome do Funcionário", "FUNCIONÁRIO");
      const registration =
        cell(row, "CdChamada", "Matrícula", "Funcionário") ||
        cell(row, "matricula");
      if (!fullName || !registration) {
        skipped += 1;
        continue;
      }
      const department = cell(row, "nmdepartamento", "Departamento", "UNIDADE");
      const city = cell(row, "nmcidade", "cidade", "Cidade");
      const roleName = cell(row, "nmfuncao", "Função", "FUNÇÃO");
      const regionName = cell(row, "Regional") || "NAO_INFORMADA";
      const statusRaw = cell(row, "Status_ASO", "Situação");
      const functionalStatus =
        statusRaw.toUpperCase().includes("DEMIT") || cell(row, "DtDemissao")
          ? "DEMITIDO"
          : "ATIVO";

      const regionId = await ensureRegion(regionName);
      const unitId = department
        ? await ensureUnit(regionId, department, city)
        : null;
      const jobRoleId = await ensureRole(roleName);

      const [existing] = await db
        .select()
        .from(employees)
        .where(
          and(
            eq(employees.registration, registration),
            isNull(employees.deletedAt),
          ),
        )
        .limit(1);

      const payload = {
        registration,
        fullName,
        normalizedName: normalizeText(fullName),
        city: city || null,
        functionalStatus,
        regionId,
        unitId,
        jobRoleId,
        sourceSystem: "ALTERDATA",
        alterdataId: registration,
      };

      if (existing) {
        await db
          .update(employees)
          .set(payload)
          .where(eq(employees.id, existing.id));
        updated += 1;
      } else {
        await db.insert(employees).values(payload);
        imported += 1;
      }
    } catch (err) {
      errors += 1;
      const message = err instanceof Error ? err.message : String(err);
      errorRows.push({ row: i + 2, message });
      await db.insert(importErrors).values({
        batchId: batch.id,
        rowNumber: i + 2,
        message,
      });
    }
  }

  await db
    .update(importBatches)
    .set({
      status: errors ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
      importedRows: imported,
      updatedRows: updated,
      skippedRows: skipped,
      errorRows: errors,
      reportSummary: JSON.stringify({ fileHash, sheetName }),
    })
    .where(eq(importBatches.id, batch.id));

  const reportDir = path.join(process.cwd(), "import-reports");
  mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(
    reportDir,
    `employees-${batch.id}.json`,
  );
  writeFileSync(
    reportPath,
    JSON.stringify(
      { batchId: batch.id, imported, updated, skipped, errors, errorRows },
      null,
      2,
    ),
  );

  console.log({ imported, updated, skipped, errors, reportPath });
  await client.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
