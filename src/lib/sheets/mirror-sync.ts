/**
 * Sync somente-leitura do espelho Google Sheets (IMPORTRANGE).
 * NUNCA escreve na planilha — apenas HTTP GET (CSV/gviz).
 * Sheet ID: somente via ALTERDATA_MIRROR_SHEET_ID (nunca hardcode em produção).
 */
import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNull, like, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  asoAlterdataSnapshots,
  employees,
  importBatches,
  importErrors,
  jobRoles,
  regions,
  units,
} from "@/db/schemas";
import { writeAuditLog } from "@/lib/audit";
import { parsePeriodicityMonths } from "@/lib/aso/planning";
import {
  mapAlterdataFunctionalStatus,
  mapAlterdataSex,
} from "@/lib/employees/alterdata-status";
import { hashCpf, normalizeCpf } from "@/lib/encryption";
import { getEnv } from "@/lib/env";
import {
  decideCpfSyncFields,
  emptyCpfSyncStats,
  mergeCpfFields,
  tallyCpfDiagnostic,
} from "@/lib/employees/cpf-sync";
import { normalizeRegionName, normalizeText } from "@/lib/validation";
import type { SessionUser } from "@/types";

export type MirrorSyncResult = {
  ok: boolean;
  error?: string;
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  batchId?: string;
  headers?: string[];
};

function mirrorSheetId() {
  const id = process.env.ALTERDATA_MIRROR_SHEET_ID?.trim();
  if (!id) {
    throw new Error(
      "ALTERDATA_MIRROR_SHEET_ID não configurada. Defina a variável na Vercel/ambiente.",
    );
  }
  return id;
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

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
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

  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  const data = rows.slice(1).map((cols) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] ?? "").trim();
    });
    return obj;
  });
  return { headers, rows: data };
}

/** Valor da célula se a coluna existir; distingue ausente vs vazia. */
function cellInfo(
  row: Record<string, string>,
  ...keys: string[]
): { present: boolean; value: string } {
  for (const key of keys) {
    const found = Object.keys(row).find(
      (k) => normalizeText(k) === normalizeText(key),
    );
    if (found !== undefined) {
      return { present: true, value: (row[found] ?? "").trim() };
    }
  }
  return { present: false, value: "" };
}

function cell(row: Record<string, string>, ...keys: string[]) {
  const info = cellInfo(row, ...keys);
  return info.present ? info.value : "";
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

function keepText(
  incoming: string | null | undefined,
  existing: string | null | undefined,
): string | null {
  const v = (incoming ?? "").trim();
  if (v) return v;
  return existing ?? null;
}

function keepDate(
  incoming: string | null,
  existing: string | null | undefined,
): string | null {
  if (incoming) return incoming;
  return existing ?? null;
}

/** Variantes de matrícula (com/sem zeros à esquerda) para match entre planilha e Alterdata. */
function registrationLookupKeys(registration: string): string[] {
  const raw = registration.trim();
  const digits = raw.replace(/\D/g, "");
  const keys = new Set<string>([raw]);
  if (digits) {
    keys.add(digits);
    for (const pad of [5, 6, 7, 8]) {
      keys.add(digits.padStart(pad, "0"));
    }
  }
  return [...keys];
}

export async function syncAlterdataMirror(options?: {
  user?: SessionUser | null;
}): Promise<MirrorSyncResult> {
  const db = getDb();

  const [running] = await db
    .select({ id: importBatches.id })
    .from(importBatches)
    .where(
      and(
        eq(importBatches.status, "RUNNING"),
        like(importBatches.sourceName, "mirror:%"),
      ),
    )
    .limit(1);

  if (running) {
    return {
      ok: false,
      error:
        "Já existe uma sincronização do espelho em andamento. Aguarde o término.",
      totalRows: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      batchId: running.id,
    };
  }

  const csv = await fetchMirrorCsv();
  const { headers, rows } = parseCsv(csv);
  if (!rows.length) {
    return {
      ok: false,
      error: "Espelho sem linhas úteis.",
      totalRows: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      headers,
    };
  }

  const fileHash = createHash("sha256").update(csv).digest("hex");
  const [batch] = await db
    .insert(importBatches)
    .values({
      sourceName: `mirror:${mirrorSheetId()}`,
      status: "RUNNING",
      totalRows: rows.length,
      reportSummary: `sourceHash=${fileHash};userAgent=server;ip=n/a`,
      createdBy: options?.user?.id,
      updatedBy: options?.user?.id,
    })
    .returning();

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const seenCpfHashes = new Map<string, string>(); // hash → registration
  const syncedAt = new Date();
  const cpfStats = emptyCpfSyncStats();
  const encryptionEnabled = Boolean(getEnv().FIELD_ENCRYPTION_KEY);

  const regionCache = new Map<string, string>();
  const unitCache = new Map<string, string>();
  const roleCache = new Map<string, string>();

  async function maybeInsertAsoSnapshot(input: {
    db: ReturnType<typeof getDb>;
    employeeId: string;
    registration: string;
    row: Record<string, string>;
    regionId: string | null;
    unitId: string | null;
    batchId: string;
    fileHash: string;
    syncedAt: Date;
  }) {
    const nextAsoDate = toDate(
      cell(input.row, "Proximo_aso", "Data Proximo ASO", "Proximo ASO"),
    );
    const lastAsoDate = toDate(
      cell(input.row, "Data_Atestado", "Data_Atestado_(2026)", "Data Atestado"),
    );
    const statusAso = cell(input.row, "Status_ASO") || null;
    const periodicityMonths = parsePeriodicityMonths(
      cell(input.row, "Periodicidade"),
    );

    const [latest] = await input.db
      .select({
        nextAsoDate: asoAlterdataSnapshots.nextAsoDate,
        statusAso: asoAlterdataSnapshots.statusAso,
      })
      .from(asoAlterdataSnapshots)
      .where(eq(asoAlterdataSnapshots.employeeId, input.employeeId))
      .orderBy(desc(asoAlterdataSnapshots.syncedAt))
      .limit(1);

    if (
      latest &&
      latest.nextAsoDate === nextAsoDate &&
      (latest.statusAso || null) === statusAso
    ) {
      return;
    }

    await input.db.insert(asoAlterdataSnapshots).values({
      employeeId: input.employeeId,
      registration: input.registration,
      nextAsoDate,
      lastAsoDate,
      statusAso,
      periodicityMonths,
      regionId: input.regionId,
      unitId: input.unitId,
      syncedAt: input.syncedAt,
      batchId: input.batchId,
      sourceHash: input.fileHash,
      sourceRef: "ALTERDATA_MIRROR:Proximo_aso",
    });
  }

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
      const cityRaw = cell(row, "nmcidade", "cidade", "Cidade");
      const roleName = cell(row, "nmfuncao", "Função", "FUNÇÃO");
      const regionName = cell(row, "Regional") || "NAO_INFORMADA";
      const demissaoRaw = cell(row, "DtDemissao");
      const statusAso = cell(row, "Status_ASO");
      const statusFerias = cell(row, "Status_Ferias", "StatusFerias", "Ferias");
      const afastamentoRaw = cell(
        row,
        "Afastamento",
        "Status_Afastamento",
        "Situacao",
        "Situação",
        "SituacaoFuncional",
      );
      const functionalStatus = mapAlterdataFunctionalStatus({
        dismissalRaw: demissaoRaw,
        statusAso,
        afastamentoRaw,
        statusFerias,
      });

      const regionId = await ensureRegion(regionName);
      const unitId = department
        ? await ensureUnit(regionId, department, cityRaw)
        : null;
      const jobRoleId = await ensureRole(roleName);

      const cpfRaw = cell(row, "NrCPF", "CPF");
      let hashOwnerInDb: string | null = null;
      const digitsPreview = cpfRaw ? normalizeCpf(cpfRaw) : "";
      if (digitsPreview.length === 11) {
        const previewHash = hashCpf(digitsPreview);
        const [cpfOwner] = await db
          .select({ registration: employees.registration })
          .from(employees)
          .where(
            and(
              eq(employees.cpfHash, previewHash),
              isNull(employees.deletedAt),
            ),
          )
          .limit(1);
        hashOwnerInDb = cpfOwner?.registration ?? null;
      }

      const decision = decideCpfSyncFields({
        cpfRaw,
        registration,
        hashOwnerInBatch:
          digitsPreview.length === 11
            ? seenCpfHashes.get(hashCpf(digitsPreview))
            : undefined,
        hashOwnerInDb,
        encryptionEnabled,
      });
      tallyCpfDiagnostic(cpfStats, decision.diagnostic);

      if (
        decision.diagnostic === "CPF_DUPLICATE_HASH" &&
        decision.conflictRegistration
      ) {
        await db.insert(importErrors).values({
          batchId: batch.id,
          rowNumber: i + 2,
          message: `CPF duplicado no Alterdata entre as matrículas ${decision.conflictRegistration} e ${registration}. Matrícula preservada como chave; hash não duplicado.`,
        });
      }

      if (decision.cpfHash) {
        seenCpfHashes.set(decision.cpfHash, registration);
      }

      const phoneRaw = cell(row, "NrTelefone", "NrCelular");
      const sexMapped = mapAlterdataSex(cell(row, "TpSexo"));
      const admissionParsed = toDate(cell(row, "DtAdmissao"));
      const dismissalParsed = toDate(demissaoRaw);
      const birthParsed = toDate(cell(row, "DtNascimento"));

      const [existing] = await db
        .select()
        .from(employees)
        .where(
          and(
            inArray(employees.registration, registrationLookupKeys(registration)),
            isNull(employees.deletedAt),
          ),
        )
        .limit(1);

      if (existing) {
        const merged = mergeCpfFields({
          decision,
          existingHash: existing.cpfHash,
          existingEncrypted: existing.cpfEncrypted,
        });

        // Se o hash novo conflita com outro registro, não troca o hash desta matrícula
        let nextCpfHash = merged.cpfHash;
        let nextCpfEncrypted = merged.cpfEncrypted;
        if (
          decision.cpfHash &&
          existing.cpfHash &&
          decision.cpfHash !== existing.cpfHash
        ) {
          const [other] = await db
            .select({ id: employees.id })
            .from(employees)
            .where(
              and(
                eq(employees.cpfHash, decision.cpfHash),
                isNull(employees.deletedAt),
              ),
            )
            .limit(1);
          if (other && other.id !== existing.id) {
            nextCpfHash = existing.cpfHash;
            nextCpfEncrypted =
              decision.cpfEncrypted ?? existing.cpfEncrypted ?? null;
          }
        }

        await db
          .update(employees)
          .set({
            registration,
            fullName,
            normalizedName: normalizeText(fullName),
            city: keepText(cityRaw, existing.city),
            phone: keepText(phoneRaw, existing.phone),
            sex: keepText(sexMapped, existing.sex),
            admissionDate: keepDate(admissionParsed, existing.admissionDate),
            dismissalDate: keepDate(dismissalParsed, existing.dismissalDate),
            birthDate: keepDate(birthParsed, existing.birthDate),
            functionalStatus,
            regionId: regionId || existing.regionId,
            unitId: unitId ?? existing.unitId,
            jobRoleId: jobRoleId ?? existing.jobRoleId,
            cpfHash: nextCpfHash,
            cpfEncrypted: nextCpfEncrypted,
            sourceSystem: "ALTERDATA_MIRROR",
            alterdataId: registration,
            updatedBy: options?.user?.id ?? null,
          })
          .where(eq(employees.id, existing.id));
        updated += 1;
        await maybeInsertAsoSnapshot({
          db,
          employeeId: existing.id,
          registration,
          row,
          regionId: regionId || existing.regionId,
          unitId: unitId ?? existing.unitId,
          batchId: batch.id,
          fileHash,
          syncedAt,
        });
      } else {
        const payload = {
          registration,
          fullName,
          normalizedName: normalizeText(fullName),
          city: cityRaw || null,
          phone: phoneRaw || null,
          sex: sexMapped,
          admissionDate: admissionParsed,
          dismissalDate: dismissalParsed,
          birthDate: birthParsed,
          functionalStatus,
          regionId,
          unitId,
          jobRoleId,
          cpfHash: decision.cpfHash,
          cpfEncrypted: decision.cpfEncrypted,
          sourceSystem: "ALTERDATA_MIRROR",
          alterdataId: registration,
          updatedBy: options?.user?.id ?? null,
          createdBy: options?.user?.id ?? null,
        };
        let employeeId: string;
        try {
          const [created] = await db
            .insert(employees)
            .values(payload)
            .returning({ id: employees.id });
          employeeId = created.id;
          imported += 1;
        } catch {
          // Unique de hash: grava sem hash, preserva encrypted
          const [created] = await db
            .insert(employees)
            .values({
              ...payload,
              cpfHash: null,
              cpfEncrypted: decision.cpfEncrypted,
            })
            .returning({ id: employees.id });
          employeeId = created.id;
          imported += 1;
        }
        await maybeInsertAsoSnapshot({
          db,
          employeeId,
          registration,
          row,
          regionId,
          unitId,
          batchId: batch.id,
          fileHash,
          syncedAt,
        });
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

  const finishedAt = new Date().toISOString();
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
        finishedAt,
        headers,
        imported,
        updated,
        skipped,
        errors,
        origin: "ALTERDATA_MIRROR",
        cpf: cpfStats,
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
      headerCount: headers.length,
      cpf: cpfStats,
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
    headers,
  };
}

export type AsoSnapshotSyncResult = MirrorSyncResult & {
  snapshotsInserted: number;
  unmatched: number;
};

/**
 * Sync rápido para o painel de ASOs: lê o espelho e grava somente snapshots
 * de Proximo_aso / Status_ASO. Não upserta cadastro de colaboradores.
 */
export async function syncAlterdataAsoSnapshots(options?: {
  user?: SessionUser | null;
}): Promise<AsoSnapshotSyncResult> {
  const db = getDb();

  const [running] = await db
    .select({ id: importBatches.id })
    .from(importBatches)
    .where(
      and(
        eq(importBatches.status, "RUNNING"),
        like(importBatches.sourceName, "mirror%"),
      ),
    )
    .limit(1);

  if (running) {
    return {
      ok: false,
      error:
        "Já existe uma sincronização do espelho em andamento. Aguarde o término.",
      totalRows: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      snapshotsInserted: 0,
      unmatched: 0,
      batchId: running.id,
    };
  }

  const csv = await fetchMirrorCsv();
  const { headers, rows } = parseCsv(csv);
  if (!rows.length) {
    return {
      ok: false,
      error: "Espelho sem linhas úteis.",
      totalRows: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      snapshotsInserted: 0,
      unmatched: 0,
      headers,
    };
  }

  const fileHash = createHash("sha256").update(csv).digest("hex");
  const [batch] = await db
    .insert(importBatches)
    .values({
      sourceName: `mirror-aso:${mirrorSheetId()}`,
      status: "RUNNING",
      totalRows: rows.length,
      reportSummary: `sourceHash=${fileHash};mode=ASO_SNAPSHOTS_ONLY`,
      createdBy: options?.user?.id,
      updatedBy: options?.user?.id,
    })
    .returning();

  const empRows = await db
    .select({
      id: employees.id,
      registration: employees.registration,
      regionId: employees.regionId,
      unitId: employees.unitId,
    })
    .from(employees)
    .where(isNull(employees.deletedAt));

  const byReg = new Map<
    string,
    {
      id: string;
      registration: string;
      regionId: string | null;
      unitId: string | null;
    }
  >();
  for (const emp of empRows) {
    const reg = emp.registration.trim();
    byReg.set(reg, emp);
    if (/^\d+$/.test(reg)) {
      byReg.set(reg.padStart(5, "0"), emp);
      const unpadded = reg.replace(/^0+/, "") || "0";
      byReg.set(unpadded, emp);
    }
  }

  const latestRaw = await db.execute(sql`
    SELECT DISTINCT ON (employee_id)
      employee_id,
      next_aso_date,
      status_aso
    FROM occupational.aso_alterdata_snapshots
    ORDER BY employee_id, synced_at DESC
  `);
  const latestList = (
    Array.isArray(latestRaw)
      ? latestRaw
      : ((latestRaw as { rows?: unknown[] }).rows ?? [])
  ) as Array<{
    employee_id: string;
    next_aso_date: string | null;
    status_aso: string | null;
  }>;

  const latestByEmployee = new Map<
    string,
    { nextAsoDate: string | null; statusAso: string | null }
  >();
  for (const row of latestList) {
    latestByEmployee.set(row.employee_id, {
      nextAsoDate: row.next_aso_date,
      statusAso: row.status_aso,
    });
  }

  const syncedAt = new Date();
  let skipped = 0;
  let unmatched = 0;
  let errors = 0;
  const pendingInserts: (typeof asoAlterdataSnapshots.$inferInsert)[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const registration = cell(
        row,
        "CdChamada",
        "Matrícula",
        "Funcionário",
      ).trim();
      if (!registration) {
        skipped += 1;
        continue;
      }

      const emp = byReg.get(registration)
        ?? (/^\d+$/.test(registration)
          ? byReg.get(registration.padStart(5, "0"))
            ?? byReg.get(registration.replace(/^0+/, "") || "0")
          : undefined);

      if (!emp) {
        unmatched += 1;
        continue;
      }

      const nextAsoDate = toDate(
        cell(row, "Proximo_aso", "Data Proximo ASO", "Proximo ASO"),
      );
      const lastAsoDate = toDate(
        cell(row, "Data_Atestado", "Data_Atestado_(2026)", "Data Atestado"),
      );
      const statusAso = cell(row, "Status_ASO") || null;
      const periodicityMonths = parsePeriodicityMonths(
        cell(row, "Periodicidade"),
      );

      const latest = latestByEmployee.get(emp.id);
      if (
        latest &&
        latest.nextAsoDate === nextAsoDate &&
        (latest.statusAso || null) === statusAso
      ) {
        skipped += 1;
        continue;
      }

      pendingInserts.push({
        employeeId: emp.id,
        registration: emp.registration,
        nextAsoDate,
        lastAsoDate,
        statusAso,
        periodicityMonths,
        regionId: emp.regionId,
        unitId: emp.unitId,
        syncedAt,
        batchId: batch.id,
        sourceHash: fileHash,
        sourceRef: "ALTERDATA_MIRROR:Proximo_aso",
      });
      latestByEmployee.set(emp.id, { nextAsoDate, statusAso });
    } catch (err) {
      errors += 1;
      await db.insert(importErrors).values({
        batchId: batch.id,
        rowNumber: i + 2,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const CHUNK = 250;
  for (let i = 0; i < pendingInserts.length; i += CHUNK) {
    const chunk = pendingInserts.slice(i, i + CHUNK);
    await db.insert(asoAlterdataSnapshots).values(chunk);
  }

  const snapshotsInserted = pendingInserts.length;
  const finishedAt = new Date().toISOString();
  await db
    .update(importBatches)
    .set({
      status: errors ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
      importedRows: snapshotsInserted,
      updatedRows: 0,
      skippedRows: skipped,
      errorRows: errors,
      reportSummary: JSON.stringify({
        fileHash,
        sheetId: mirrorSheetId(),
        mode: "ASO_SNAPSHOTS_ONLY",
        finishedAt,
        headers,
        snapshotsInserted,
        skipped,
        unmatched,
        errors,
        origin: "ALTERDATA_MIRROR",
      }),
      updatedBy: options?.user?.id ?? null,
    })
    .where(eq(importBatches.id, batch.id));

  await writeAuditLog({
    user: options?.user,
    action: "SYNC_MIRROR",
    entityType: "aso_alterdata_snapshots",
    entityId: batch.id,
    metadata: {
      mode: "ASO_SNAPSHOTS_ONLY",
      snapshotsInserted,
      skipped,
      unmatched,
      errors,
      source: "aso_panel",
    },
  });

  return {
    ok: true,
    totalRows: rows.length,
    imported: snapshotsInserted,
    updated: 0,
    skipped,
    errors,
    snapshotsInserted,
    unmatched,
    batchId: batch.id,
    headers,
  };
}
