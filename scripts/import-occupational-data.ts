/**
 * Importação ocupacional multi-aba.
 * Uso: npm run import:occupational -- --file=./planilha.xlsx --yes
 */
import "dotenv/config";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "../src/db/schemas";
import {
  asoRecords,
  biologicalAccidentFollowups,
  biologicalAccidents,
  employeeVaccinations,
  employees,
  importBatches,
  leaveRecords,
  pregnancyCases,
  vaccines,
} from "../src/db/schemas";
import { addMonths } from "date-fns";

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
function excelDate(value: string) {
  if (!value) return null;
  if (/^\d+(\.\d+)?$/.test(value)) {
    const n = Number(value);
    const d = XLSX.SSF.parse_date_code(n);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

async function main() {
  const file = arg("file");
  const yes = hasFlag("yes");
  if (!file) {
    console.error("Uso: npm run import:occupational -- --file=./planilha.xlsx --yes");
    process.exit(1);
  }
  if (!existsSync(file)) throw new Error(`Arquivo não encontrado: ${file}`);
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");

  const wb = XLSX.readFile(file);
  console.log("Abas:", wb.SheetNames.join(", "));
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

  const [batch] = await db
    .insert(importBatches)
    .values({
      sourceName: path.basename(file),
      status: "RUNNING",
      totalRows: 0,
    })
    .returning();

  const stats = {
    aso: 0,
    leaves: 0,
    vaccines: 0,
    pregnancies: 0,
    bio: 0,
    skipped: 0,
    errors: 0,
  };

  async function employeeIdByRegistration(registration: string) {
    if (!registration) return null;
    const [row] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(eq(employees.registration, registration), isNull(employees.deletedAt)),
      )
      .limit(1);
    return row?.id ?? null;
  }

  // ASO 2026
  const asoSheet =
    wb.Sheets["ASO 2026"] ||
    wb.Sheets[wb.SheetNames.find((n) => n.toUpperCase().includes("ASO")) ?? ""];
  if (asoSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(asoSheet, {
      defval: "",
    });
    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        const registration = cell(row, "Funcionário", "Matrícula");
        const employeeId = await employeeIdByRegistration(registration);
        if (!employeeId) {
          stats.skipped += 1;
          continue;
        }
        const typeRaw = cell(row, "Tipo Proximo ASO");
        const asoType = normalizeText(typeRaw).includes("ADMISS")
          ? "ADMISSIONAL"
          : normalizeText(typeRaw).includes("DEMISS")
            ? "DEMISSIONAL"
            : normalizeText(typeRaw).includes("RETORNO")
              ? "RETORNO_TRABALHO"
              : "PERIODICO";
        const next = excelDate(cell(row, "Data Proximo ASO"));
        const performed = excelDate(cell(row, "Data_Atestado_(2026)", "Data_Atestado"));
        await db.insert(asoRecords).values({
          employeeId,
          asoType,
          nextAsoDate: next,
          performedDate: performed,
          lastAsoDate: performed,
          deadlineStatus: next
            ? new Date(next) < new Date()
              ? "VENCIDO"
              : "EM_DIA"
            : "NAO_APLICAVEL",
          periodicityMonths: 12,
          sourceSheet: "ASO 2026",
          sourceRow: i + 2,
        });
        stats.aso += 1;
      } catch {
        stats.errors += 1;
      }
    }
  }

  // Afastados
  const leaveSheet = wb.Sheets["Afastados"];
  if (leaveSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(leaveSheet, {
      defval: "",
    });
    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        const registration = cell(
          row,
          "SEDE/DESSMA/RGT/0011 - Planilha de Afastados   CONTROLE DE AFASTAMENTO  |  SAÚDE OCUPACIONAL - EMSERH Matrícula",
          "Matrícula",
        );
        const employeeId = await employeeIdByRegistration(registration);
        if (!employeeId) {
          stats.skipped += 1;
          continue;
        }
        const start = excelDate(cell(row, "Início Afastamento"));
        if (!start) {
          stats.skipped += 1;
          continue;
        }
        await db.insert(leaveRecords).values({
          employeeId,
          leaveType: cell(row, "Motivo") || "ATESTADO",
          startDate: start,
          endDate: excelDate(cell(row, "Fim Afastamento")),
          cidCode: cell(row, "CID") || null,
          cidNormalized: cell(row, "CID").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || null,
          reasonSimplified: cell(row, "MOTIVO_SIMPLIFICADO") || null,
          status: "ATIVO",
          sourceSheet: "Afastados",
          sourceRow: i + 2,
        });
        stats.leaves += 1;
      } catch {
        stats.errors += 1;
      }
    }
  }

  // Vacinas
  const vacSheet = wb.Sheets["Vacinas"];
  if (vacSheet) {
    const catalog = [
      ["TETANO", "Tétano", "TÉTANO", "TETANO"],
      ["HEPATITE_B", "Hepatite B", "HEPATITE B"],
      ["TRIPLICE", "Tríplice viral", "TRÍPLICE", "TRIPLICE"],
      ["FEBRE_AMARELA", "Febre amarela", "FEBRE AM."],
      ["H1N1", "Influenza/H1N1", "H1N1"],
      ["COVID", "COVID-19", "COVID"],
    ] as const;

    for (const [code, name] of catalog) {
      const [existing] = await db
        .select()
        .from(vaccines)
        .where(eq(vaccines.code, code))
        .limit(1);
      if (!existing) {
        await db.insert(vaccines).values({ code, name });
      }
    }

    const vacRows = await db.select().from(vaccines);
    const byCode = Object.fromEntries(vacRows.map((v) => [v.code, v.id]));

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(vacSheet, {
      defval: "",
    });
    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        const registration = cell(
          row,
          "SEDE/DESSMA/RGT/00XX - Verificar MATRÍCULA",
          "Matrícula",
        );
        const employeeId = await employeeIdByRegistration(registration);
        if (!employeeId) {
          stats.skipped += 1;
          continue;
        }
        for (const [code, , ...aliases] of catalog) {
          const value = cell(row, ...aliases);
          if (!value) continue;
          await db.insert(employeeVaccinations).values({
            employeeId,
            vaccineId: byCode[code],
            doseNumber: 1,
            notes: value,
            status: "IMPORTADO",
            sourceSheet: "Vacinas",
            sourceRow: i + 2,
          });
          stats.vaccines += 1;
        }
      } catch {
        stats.errors += 1;
      }
    }
  }

  // Gestantes
  const gestSheet = wb.Sheets["Gestantes"];
  if (gestSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(gestSheet, {
      defval: "",
    });
    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        const registration = cell(
          row,
          "SEDE/DESSMA/RGT/0014 - Planilha de Acompanhamento de Gestantes Matricula",
          "Matricula",
          "Matrícula",
        );
        const employeeId = await employeeIdByRegistration(registration);
        if (!employeeId) {
          stats.skipped += 1;
          continue;
        }
        const hazardous = normalizeText(
          cell(row, "Exerce atividade Insalubre?"),
        ).startsWith("S");
        await db.insert(pregnancyCases).values({
          employeeId,
          proofType: cell(row, "Tipo de comprovação") || null,
          hazardousActivity: hazardous,
          relocationNeeded: hazardous,
          originSector: cell(row, "Setor Origem") || null,
          destinationSector: cell(row, "Setor Realocação") || null,
          relocationDate: excelDate(cell(row, "Data Realocação")),
          status: cell(row, "STATUS") || "EM_ACOMPANHAMENTO",
          notes: cell(row, "OBS") || null,
          sourceSheet: "Gestantes",
          sourceRow: i + 2,
        });
        stats.pregnancies += 1;
      } catch {
        stats.errors += 1;
      }
    }
  }

  // Material Biológico
  const bioSheet = wb.Sheets["Material Biológico"];
  if (bioSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(bioSheet, {
      defval: "",
    });
    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        const registration = cell(
          row,
          "SEDE/DESSMA/RGT/0015- Planilha de  Acompanhamento de Material Biológico  MATRÍCULA",
          "MATRÍCULA",
          "Matrícula",
        );
        const employeeId = await employeeIdByRegistration(registration);
        if (!employeeId) {
          stats.skipped += 1;
          continue;
        }
        const occurred = excelDate(cell(row, "DT OCORRÊNCIA")) ?? new Date().toISOString().slice(0, 10);
        const occurredAt = new Date(`${occurred}T12:00:00`);
        const [created] = await db
          .insert(biologicalAccidents)
          .values({
            employeeId,
            occurredAt,
            exposureType: cell(row, "TIPO DE ACIDENTE") || null,
            description: cell(row, "DESCRIÇÃO DA OCORRÊNCIA") || null,
            pepStarted: Boolean(cell(row, "PEP")),
            catNumber: cell(row, "NÚMERO DA CAT") || null,
            status: "EM_ACOMPANHAMENTO",
            sourceSheet: "Material Biológico",
            sourceRow: i + 2,
          })
          .returning({ id: biologicalAccidents.id });

        for (const dayOffset of [30, 60, 90]) {
          const due = addMonths(occurredAt, 0);
          due.setDate(due.getDate() + dayOffset);
          await db.insert(biologicalAccidentFollowups).values({
            accidentId: created.id,
            dayOffset,
            dueDate: due.toISOString().slice(0, 10),
            status: "PENDENTE",
          });
        }
        stats.bio += 1;
      } catch {
        stats.errors += 1;
      }
    }
  }

  await db
    .update(importBatches)
    .set({
      status: stats.errors ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
      importedRows:
        stats.aso +
        stats.leaves +
        stats.vaccines +
        stats.pregnancies +
        stats.bio,
      skippedRows: stats.skipped,
      errorRows: stats.errors,
      reportSummary: JSON.stringify(stats),
    })
    .where(eq(importBatches.id, batch.id));

  const reportDir = path.join(process.cwd(), "import-reports");
  mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `occupational-${batch.id}.json`);
  writeFileSync(reportPath, JSON.stringify({ batchId: batch.id, stats }, null, 2));
  console.log({ stats, reportPath });
  await client.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
