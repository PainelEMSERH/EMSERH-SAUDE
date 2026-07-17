/**
 * Importação ocupacional RÁPIDA (pg direto + lotes).
 * Uso: npm run import:occupational:fast -- --file="./Planilha Sistema Saúde.xlsx"
 *
 * - Carrega matrículas 1x em memória
 * - INSERT em lotes de 500
 * - Remove registros anteriores das mesmas source_sheet antes de gravar (evita duplicar parcial)
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import * as XLSX from "xlsx";
import { Client } from "pg";

config({ path: resolve(process.cwd(), ".env.local") });

function arg(name: string) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
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
  for (const key of keys) {
    const nk = normalizeText(key);
    if (nk.length < 3) continue;
    const found = Object.keys(row).find((k) => normalizeText(k).includes(nk));
    if (found && row[found] != null && String(row[found]).trim() !== "") {
      return String(row[found]).trim();
    }
  }
  return "";
}

function rememberEmp(map: Map<string, string>, registration: string, id: string) {
  map.set(registration, id);
  const digits = registration.replace(/\D/g, "");
  if (digits) {
    map.set(digits, id);
    for (const pad of [5, 6, 7, 8]) {
      map.set(digits.padStart(pad, "0"), id);
    }
  }
}

async function ensureEmployee(
  client: Client,
  map: Map<string, string>,
  registration: string,
  fullName: string,
): Promise<string | null> {
  const existing = resolveEmp(map, registration);
  if (existing) return existing;
  const reg = registration.trim();
  if (!reg) return null;
  const name = (fullName || `COLABORADOR ${reg}`).trim().slice(0, 200);
  const ins = await client.query<{ id: string }>(
    `insert into core.employees
      (registration, full_name, normalized_name, functional_status, source_system)
     values ($1, $2, $3, 'ATIVO', 'PLANILHA_OCUPACIONAL')
     on conflict (registration) do update
       set full_name = excluded.full_name,
           updated_at = now(),
           deleted_at = null
     returning id`,
    [reg, name, normalizeText(name)],
  );
  const id = ins.rows[0]?.id;
  if (!id) return null;
  rememberEmp(map, reg, id);
  return id;
}

function excelDate(value: string): string | null {
  if (!value) return null;
  if (/^\d+(\.\d+)?$/.test(value)) {
    const n = Number(value);
    // Serial Excel absurdo (corrupção na planilha) — ignora
    if (n < 20000 || n > 60000) return null;
    const d = XLSX.SSF.parse_date_code(n);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function resolveEmp(
  map: Map<string, string>,
  registration: string,
): string | null {
  if (!registration) return null;
  const raw = registration.trim();
  if (map.has(raw)) return map.get(raw)!;
  const digits = raw.replace(/\D/g, "");
  if (digits && map.has(digits)) return map.get(digits)!;
  if (digits) {
    for (const pad of [5, 6, 7, 8]) {
      const p = digits.padStart(pad, "0");
      if (map.has(p)) return map.get(p)!;
    }
  }
  return null;
}

async function insertBatch(
  client: Client,
  sqlPrefix: string,
  rows: unknown[][],
  chunkSize = 400,
) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    if (!chunk.length) continue;
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let p = 1;
    for (const row of chunk) {
      const ph = row.map(() => `$${p++}`);
      placeholders.push(`(${ph.join(",")})`);
      values.push(...row);
    }
    await client.query(`${sqlPrefix} VALUES ${placeholders.join(",")}`, values);
    inserted += chunk.length;
  }
  return inserted;
}

async function main() {
  const file =
    arg("file") ||
    [...(await import("node:fs")).readdirSync(process.cwd())].find((f) =>
      /^Planilha Sistema.*\.xlsx$/i.test(f),
    );
  if (!file || !existsSync(file)) {
    console.error(
      'Uso: npm run import:occupational:fast -- --file="./Planilha Sistema Saúde.xlsx"',
    );
    process.exit(1);
  }

  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");

  console.time("total");
  console.log("Lendo", file);
  const wb = XLSX.readFile(file);
  console.log("Abas:", wb.SheetNames.join(", "));

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const empRes = await client.query<{ id: string; registration: string }>(
    `select id, registration from core.employees where deleted_at is null`,
  );
  const empMap = new Map<string, string>();
  for (const r of empRes.rows) {
    rememberEmp(empMap, r.registration, r.id);
  }
  console.log("Colaboradores em memória:", empRes.rows.length);

  await client.query(
    `update files.import_batches set status='CANCELLED', updated_at=now() where status='RUNNING'`,
  );

  const batch = await client.query<{ id: string }>(
    `insert into files.import_batches (source_name, status, total_rows)
     values ($1, 'RUNNING', 0) returning id`,
    [basename(file)],
  );
  const batchId = batch.rows[0].id;

  const stats = {
    aso: 0,
    leaves: 0,
    vaccines: 0,
    pregnancies: 0,
    bio: 0,
    followups: 0,
    skipped: 0,
    errors: 0,
  };

  // Limpa importações anteriores das mesmas abas (evita duplicar parcial lento)
  console.log("Limpando imports anteriores das abas...");
  await client.query(
    `delete from occupational.biological_accident_followups f
     using occupational.biological_accidents a
     where f.accident_id = a.id and a.source_sheet = 'Material Biológico'`,
  );
  await client.query(
    `delete from occupational.biological_accidents where source_sheet = 'Material Biológico'`,
  );
  await client.query(
    `delete from occupational.pregnancy_cases where source_sheet = 'Gestantes'`,
  );
  await client.query(
    `delete from occupational.employee_vaccinations where source_sheet = 'Vacinas'`,
  );
  await client.query(
    `delete from occupational.leave_records where source_sheet = 'Afastados'`,
  );
  await client.query(
    `delete from occupational.aso_records where source_sheet = 'ASO 2026'`,
  );

  // ---- ASO ----
  const asoSheet =
    wb.Sheets["ASO 2026"] ||
    wb.Sheets[wb.SheetNames.find((n) => n.toUpperCase().includes("ASO")) ?? ""];
  if (asoSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(asoSheet, {
      defval: "",
    });
    const payload: unknown[][] = [];
    let stubs = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const registration = cell(row, "Funcionário", "Matrícula", "Matricula");
      if (!registration) {
        stats.skipped += 1;
        continue;
      }
      let employeeId = resolveEmp(empMap, registration);
      if (!employeeId) {
        employeeId = await ensureEmployee(
          client,
          empMap,
          registration,
          cell(row, "Nome do Funcionário", "Nome", "FUNCIONÁRIO"),
        );
        if (employeeId) stubs += 1;
      }
      if (!employeeId) {
        stats.skipped += 1;
        continue;
      }
      const typeRaw = cell(row, "Tipo Proximo ASO");
      const nt = normalizeText(typeRaw);
      const asoType = nt.includes("ADMISS")
        ? "ADMISSIONAL"
        : nt.includes("DEMISS")
          ? "DEMISSIONAL"
          : nt.includes("RETORNO")
            ? "RETORNO_TRABALHO"
            : "PERIODICO";
      const next = excelDate(cell(row, "Data Proximo ASO"));
      const performed = excelDate(
        cell(row, "Data_Atestado_(2026)", "Data_Atestado"),
      );
      const deadline = next
        ? new Date(next) < new Date()
          ? "VENCIDO"
          : "EM_DIA"
        : "NAO_APLICAVEL";
      payload.push([
        employeeId,
        asoType,
        next,
        performed,
        performed,
        deadline,
        12,
        "ASO 2026",
        i + 2,
      ]);
    }
    stats.aso = await insertBatch(
      client,
      `insert into occupational.aso_records
        (employee_id, aso_type, next_aso_date, performed_date, last_aso_date,
         deadline_status, periodicity_months, source_sheet, source_row)`,
      payload,
    );
    console.log("ASO:", stats.aso, stubs ? `(stubs criados: ${stubs})` : "");
  }

  // ---- Afastados ----
  if (wb.Sheets["Afastados"]) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      wb.Sheets["Afastados"],
      { defval: "" },
    );
    const payload: unknown[][] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const registration = cell(
        row,
        "Matrícula",
        "Matricula",
        "SEDE/DESSMA/RGT/0011 - Planilha de Afastados   CONTROLE DE AFASTAMENTO  |  SAÚDE OCUPACIONAL - EMSERH Matrícula",
      );
      if (!registration) {
        stats.skipped += 1;
        continue;
      }
      let employeeId = resolveEmp(empMap, registration);
      if (!employeeId) {
        employeeId = await ensureEmployee(
          client,
          empMap,
          registration,
          cell(row, "Funcionario", "Funcionário", "Nome"),
        );
      }
      let start = excelDate(
        cell(row, "Início Afastamento", "Inicio Afastamento"),
      );
      const end = excelDate(cell(row, "Fim Afastamento"));
      const daysRaw = cell(row, "Qtd. Dias", "Qtd Dias", "Dias");
      const days = Number(daysRaw);
      if (!start && end && Number.isFinite(days) && days > 0) {
        const d = new Date(`${end}T12:00:00`);
        d.setDate(d.getDate() - days + 1);
        start = d.toISOString().slice(0, 10);
      }
      if (!start && end) start = end;
      // Matrícula presente sem data válida: importa com data de admissão ou marcador
      if (!start) {
        start = excelDate(cell(row, "Admissão")) || "1970-01-01";
      }
      if (!employeeId || !start) {
        stats.skipped += 1;
        continue;
      }
      const cid = cell(row, "CID") || null;
      const reasonSimplified =
        cell(row, "MOTIVO_SIMPLIFICADO") ||
        (start === "1970-01-01"
          ? "DATA_INICIO_AUSENTE_NA_PLANILHA"
          : null);
      payload.push([
        employeeId,
        cell(row, "Motivo") || "ATESTADO",
        start,
        end,
        cid,
        cid ? cid.replace(/[^A-Za-z0-9]/g, "").toUpperCase() : null,
        reasonSimplified,
        "ATIVO",
        "Afastados",
        i + 2,
      ]);
    }
    stats.leaves = await insertBatch(
      client,
      `insert into occupational.leave_records
        (employee_id, leave_type, start_date, end_date, cid_code, cid_normalized,
         reason_simplified, status, source_sheet, source_row)`,
      payload,
    );
    console.log("Afastados:", stats.leaves);
  }

  // ---- Vacinas ----
  if (wb.Sheets["Vacinas"]) {
    const catalog: Array<[string, string, ...string[]]> = [
      ["TETANO", "Tétano", "TÉTANO", "TETANO"],
      ["HEPATITE_B", "Hepatite B", "HEPATITE B"],
      ["TRIPLICE", "Tríplice viral", "TRÍPLICE", "TRIPLICE"],
      ["FEBRE_AMARELA", "Febre amarela", "FEBRE AM."],
      ["H1N1", "Influenza/H1N1", "H1N1"],
      ["COVID", "COVID-19", "COVID"],
    ];
    for (const [code, name] of catalog) {
      await client.query(
        `insert into occupational.vaccines (code, name)
         values ($1, $2)
         on conflict (code) do nothing`,
        [code, name],
      );
    }
    // vaccines.code may not have ON CONFLICT if unique is on index name - use upsert by select
    const vacRows = await client.query<{ id: string; code: string }>(
      `select id, code from occupational.vaccines`,
    );
    const byCode = Object.fromEntries(vacRows.rows.map((v) => [v.code, v.id]));
    for (const [code, name] of catalog) {
      if (!byCode[code]) {
        const ins = await client.query<{ id: string }>(
          `insert into occupational.vaccines (code, name) values ($1,$2) returning id`,
          [code, name],
        );
        byCode[code] = ins.rows[0].id;
      }
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      wb.Sheets["Vacinas"],
      { defval: "" },
    );
    const payload: unknown[][] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const registration = cell(
        row,
        "Matrícula",
        "Matricula",
        "MATRÍCULA",
        "SEDE/DESSMA/RGT/00XX - Verificar MATRÍCULA",
      );
      if (!registration) {
        stats.skipped += 1;
        continue;
      }
      let employeeId = resolveEmp(empMap, registration);
      if (!employeeId) {
        employeeId = await ensureEmployee(
          client,
          empMap,
          registration,
          cell(row, "FUNCIONÁRIO", "Funcionário", "Nome"),
        );
      }
      if (!employeeId) {
        stats.skipped += 1;
        continue;
      }
      // 1 registro por pessoa (contagem institucional ≈ linhas da aba)
      const notesParts: string[] = [];
      for (const [code, , ...aliases] of catalog) {
        const value = cell(row, ...aliases);
        if (value) notesParts.push(`${code}: ${value}`);
      }
      payload.push([
        employeeId,
        byCode.TETANO || Object.values(byCode)[0],
        1,
        notesParts.length ? notesParts.join(" | ") : "NÃO INFORMADO",
        "IMPORTADO",
        "Vacinas",
        i + 2,
      ]);
    }
    // dose unique may conflict — use ON CONFLICT DO NOTHING if constraint exists
    try {
      stats.vaccines = await insertBatch(
        client,
        `insert into occupational.employee_vaccinations
          (employee_id, vaccine_id, dose_number, notes, status, source_sheet, source_row)`,
        payload,
      );
    } catch {
      // fallback row-by-row for unique conflicts
      for (const r of payload) {
        try {
          await client.query(
            `insert into occupational.employee_vaccinations
              (employee_id, vaccine_id, dose_number, notes, status, source_sheet, source_row)
             values ($1,$2,$3,$4,$5,$6,$7)`,
            r,
          );
          stats.vaccines += 1;
        } catch {
          stats.errors += 1;
        }
      }
    }
    console.log("Vacinas:", stats.vaccines);
  }

  // ---- Gestantes ----
  if (wb.Sheets["Gestantes"]) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      wb.Sheets["Gestantes"],
      { defval: "" },
    );
    const payload: unknown[][] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const registration = cell(
        row,
        "Matricula",
        "Matrícula",
        "SEDE/DESSMA/RGT/0014 - Planilha de Acompanhamento de Gestantes Matricula",
      );
      const employeeId = resolveEmp(empMap, registration);
      if (!employeeId) {
        stats.skipped += 1;
        continue;
      }
      const hazardous = normalizeText(
        cell(row, "Exerce atividade Insalubre?"),
      ).startsWith("S");
      payload.push([
        employeeId,
        cell(row, "Tipo de comprovação") || null,
        hazardous,
        hazardous,
        cell(row, "Setor Origem") || null,
        cell(row, "Setor Realocação") || null,
        excelDate(cell(row, "Data Realocação")),
        cell(row, "STATUS") || "EM_ACOMPANHAMENTO",
        cell(row, "OBS") || null,
        "Gestantes",
        i + 2,
      ]);
    }
    stats.pregnancies = await insertBatch(
      client,
      `insert into occupational.pregnancy_cases
        (employee_id, proof_type, hazardous_activity, relocation_needed,
         origin_sector, destination_sector, relocation_date, status, notes,
         source_sheet, source_row)`,
      payload,
    );
    console.log("Gestantes:", stats.pregnancies);
  }

  // ---- Material Biológico ----
  if (wb.Sheets["Material Biológico"]) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      wb.Sheets["Material Biológico"],
      { defval: "" },
    );
    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        const registration = cell(
          row,
          "MATRÍCULA",
          "Matrícula",
          "SEDE/DESSMA/RGT/0015- Planilha de  Acompanhamento de Material Biológico  MATRÍCULA",
        );
        const employeeId = resolveEmp(empMap, registration);
        if (!employeeId) {
          stats.skipped += 1;
          continue;
        }
        const occurred =
          excelDate(cell(row, "DT OCORRÊNCIA", "DT OCORRENCIA")) ??
          new Date().toISOString().slice(0, 10);
        const pepRaw = normalizeText(cell(row, "PEP"));
        const pepStarted =
          pepRaw === "SIM" ||
          pepRaw === "S" ||
          pepRaw === "TRUE" ||
          pepRaw === "1" ||
          pepRaw === "REALIZADA";

        const ins = await client.query<{ id: string }>(
          `insert into occupational.biological_accidents
            (employee_id, occurred_at, exposure_type, description, pep_started,
             cat_number, status, source_sheet, source_row)
           values ($1, $2::timestamptz, $3, $4, $5, $6, 'EM_ACOMPANHAMENTO', 'Material Biológico', $7)
           returning id`,
          [
            employeeId,
            `${occurred}T12:00:00-03:00`,
            cell(row, "TIPO DE ACIDENTE") || null,
            cell(row, "DESCRIÇÃO DA OCORRÊNCIA", "DESCRICAO DA OCORRENCIA") ||
              null,
            pepStarted,
            cell(row, "NÚMERO DA CAT", "NUMERO DA CAT") || null,
            i + 2,
          ],
        );
        const accidentId = ins.rows[0].id;
        stats.bio += 1;

        const followups: unknown[][] = [];
        for (const dayOffset of [30, 60, 90]) {
          const due = new Date(`${occurred}T12:00:00`);
          due.setDate(due.getDate() + dayOffset);
          followups.push([
            accidentId,
            dayOffset,
            due.toISOString().slice(0, 10),
            "PENDENTE",
          ]);
        }
        stats.followups += await insertBatch(
          client,
          `insert into occupational.biological_accident_followups
            (accident_id, day_offset, due_date, status)`,
          followups,
        );
      } catch {
        stats.errors += 1;
      }
    }
    console.log("Material biológico:", stats.bio, "followups:", stats.followups);
  }

  const imported =
    stats.aso +
    stats.leaves +
    stats.vaccines +
    stats.pregnancies +
    stats.bio;

  await client.query(
    `update files.import_batches
     set status = $2, imported_rows = $3, skipped_rows = $4, error_rows = $5,
         report_summary = $6, updated_at = now()
     where id = $1`,
    [
      batchId,
      stats.errors ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
      imported,
      stats.skipped,
      stats.errors,
      JSON.stringify(stats),
    ],
  );

  console.log({ stats, batchId, note: "Agenda Médica e Atend. Externo ainda não entram neste import rápido" });
  console.timeEnd("total");
  await client.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
