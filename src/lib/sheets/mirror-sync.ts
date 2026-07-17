/**
 * Sync somente-leitura do espelho Google Sheets (IMPORTRANGE).
 * NUNCA escreve na planilha — apenas HTTP GET (CSV/gviz).
 */
import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import {
  employees,
  importBatches,
  importErrors,
  jobRoles,
  regions,
  units,
} from "@/db/schemas";
import { writeAuditLog } from "@/lib/audit";
import { hashCpf, normalizeCpf, encryptField } from "@/lib/encryption";
import { getEnv } from "@/lib/env";
import { normalizeRegionName, normalizeText } from "@/lib/validation";
import type { SessionUser } from "@/types";

export const MIRROR_SHEET_ID_DEFAULT =
  "1_SLT_VzmOMik30bBdq0EMK0f3aph104LNa3lwnn6LKg";

export type MirrorSyncResult = {
  ok: boolean;
  error?: string;
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  batchId?: string;
};

function mirrorSheetId() {
  return (
    process.env.ALTERDATA_MIRROR_SHEET_ID?.trim() || MIRROR_SHEET_ID_DEFAULT
  );
}

function mirrorGid() {
  return process.env.ALTERDATA_MIRROR_GID?.trim() || "0";
}

/** URLs de leitura apenas (GET). Sem endpoints de escrita do Google. */
export function mirrorCsvUrls(sheetId = mirrorSheetId(), gid = mirrorGid()) {
  return [
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`,
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
  ];
}

export async function fetchMirrorCsv(): Promise<string> {
  const urls = mirrorCsvUrls();
  let lastError = "Falha ao ler espelho.";

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        cache: "no-store",
        headers: { Accept: "text/csv,text/plain,*/*" },
      });
      if (!res.ok) {
        lastError = `Espelho inacessível (HTTP ${res.status}). Compartilhe o espelho como "Qualquer pessoa com o link → Leitor".`;
        continue;
      }
      const text = await res.text();
      if (
        text.includes("<!DOCTYPE html") ||
        text.toLowerCase().includes("sign in") ||
        text.length < 50
      ) {
        lastError =
          "Google pediu login. No espelho: Compartilhar → Qualquer pessoa com o link → Leitor.";
        continue;
      }
      return text;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastError);
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
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
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
  if (br) {
    return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  return null;
}

export async function syncAlterdataMirror(options?: {
  user?: SessionUser | null;
}): Promise<MirrorSyncResult> {
  const csv = await fetchMirrorCsv();
  const rows = parseCsv(csv);
  if (!rows.length) {
    return {
      ok: false,
      error: "Espelho sem linhas úteis.",
      totalRows: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };
  }

  const db = getDb();
  const fileHash = createHash("sha256").update(csv).digest("hex");
  const [batch] = await db
    .insert(importBatches)
    .values({
      sourceName: `mirror:${mirrorSheetId()}`,
      status: "RUNNING",
      totalRows: rows.length,
      createdBy: options?.user?.id,
      updatedBy: options?.user?.id,
    })
    .returning();

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const regionCache = new Map<string, string>();
  const unitCache = new Map<string, string>();
  const roleCache = new Map<string, string>();

  async function ensureRegion(name: string) {
    const code = normalizeRegionName(name || "NAO_INFORMADA");
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
      const fullName = cell(
        row,
        "NmFuncionario",
        "Nome do Funcionário",
        "FUNCIONÁRIO",
      );
      const registration = cell(
        row,
        "CdChamada",
        "Matrícula",
        "Funcionário",
      );
      if (!fullName || !registration) {
        skipped += 1;
        continue;
      }

      const department = cell(row, "nmdepartamento", "Departamento", "UNIDADE");
      const city = cell(row, "nmcidade", "cidade", "Cidade");
      const roleName = cell(row, "nmfuncao", "Função", "FUNÇÃO");
      const regionName = cell(row, "Regional") || "NAO_INFORMADA";
      const demissao = cell(row, "DtDemissao");
      const statusAso = cell(row, "Status_ASO");
      const functionalStatus =
        demissao || normalizeText(statusAso).includes("DEMIT")
          ? "DEMITIDO"
          : "ATIVO";

      const regionId = await ensureRegion(regionName);
      const unitId = department
        ? await ensureUnit(regionId, department, city)
        : null;
      const jobRoleId = await ensureRole(roleName);

      const cpfRaw = cell(row, "NrCPF", "CPF");
      let cpfHash: string | null = null;
      let cpfEncrypted: string | null = null;
      if (cpfRaw) {
        const digits = normalizeCpf(cpfRaw);
        if (digits.length === 11) {
          cpfHash = hashCpf(digits);
          if (getEnv().FIELD_ENCRYPTION_KEY) {
            try {
              cpfEncrypted = encryptField(digits);
            } catch {
              cpfEncrypted = null;
            }
          }
        }
      }

      const payload = {
        registration,
        fullName,
        normalizedName: normalizeText(fullName),
        city: city || null,
        phone: cell(row, "NrTelefone", "NrCelular") || null,
        sex: cell(row, "TpSexo") || null,
        admissionDate: toDate(cell(row, "DtAdmissao")),
        dismissalDate: toDate(demissao),
        birthDate: toDate(cell(row, "DtNascimento")),
        functionalStatus,
        regionId,
        unitId,
        jobRoleId,
        cpfHash,
        cpfEncrypted,
        sourceSystem: "ALTERDATA_MIRROR",
        alterdataId: registration,
        updatedBy: options?.user?.id ?? null,
      };

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

      if (existing) {
        await db
          .update(employees)
          .set(payload)
          .where(eq(employees.id, existing.id));
        updated += 1;
      } else {
        await db.insert(employees).values({
          ...payload,
          createdBy: options?.user?.id ?? null,
        });
        imported += 1;
      }
    } catch (err) {
      errors += 1;
      await db.insert(importErrors).values({
        batchId: batch.id,
        rowNumber: i + 2,
        message: err instanceof Error ? err.message : String(err),
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
      reportSummary: JSON.stringify({
        fileHash,
        sheetId: mirrorSheetId(),
        mode: "READ_ONLY_CSV_GET",
        officialSheetTouched: false,
      }),
      updatedBy: options?.user?.id ?? null,
    })
    .where(eq(importBatches.id, batch.id));

  await writeAuditLog({
    user: options?.user,
    action: "SYNC_MIRROR",
    entityType: "import_batch",
    entityId: batch.id,
    metadata: {
      imported,
      updated,
      skipped,
      errors,
      source: "alterdata_mirror_readonly",
    },
  });

  return {
    ok: true,
    totalRows: rows.length,
    imported,
    updated,
    skipped,
    errors,
    batchId: batch.id,
  };
}
