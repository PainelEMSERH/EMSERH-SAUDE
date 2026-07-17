import ExcelJS from "exceljs";

/** Verde institucional EMSERH (`--primary`). */
export const EXCEL_HEADER_FILL = "059669";
export const EXCEL_HEADER_FONT = "FFFFFF";
/** Calibri — fonte padrão do Excel (pedido operacional “Calibre”). */
export const EXCEL_FONT_NAME = "Calibri";
export const EXCEL_FONT_SIZE = 12;

export type ExcelColumn = {
  key: string;
  header: string;
  width?: number;
};

export type ExcelSheetInput = {
  name: string;
  columns: ExcelColumn[];
  rows: Record<string, unknown>[];
};

function cellText(value: unknown): string | number | boolean | Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  const s = String(value).trim();
  return s || null;
}

function applyHeaderStyle(cell: ExcelJS.Cell) {
  cell.font = {
    name: EXCEL_FONT_NAME,
    size: EXCEL_FONT_SIZE,
    bold: true,
    color: { argb: `FF${EXCEL_HEADER_FONT}` },
  };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${EXCEL_HEADER_FILL}` },
  };
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  cell.border = {
    top: { style: "thin", color: { argb: "FF047857" } },
    left: { style: "thin", color: { argb: "FF047857" } },
    bottom: { style: "thin", color: { argb: "FF047857" } },
    right: { style: "thin", color: { argb: "FF047857" } },
  };
}

function applyBodyStyle(cell: ExcelJS.Cell) {
  cell.font = {
    name: EXCEL_FONT_NAME,
    size: EXCEL_FONT_SIZE,
    color: { argb: "FF0F172A" },
  };
  cell.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
}

/**
 * Gera XLSX institucional: poucas abas, cabeçalho verde, Calibri 12.
 * Sem formatação exagerada — só o necessário pra abrir e usar.
 */
export async function buildStyledWorkbook(
  sheets: ExcelSheetInput[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "EMSERH Saúde Ocupacional";
  wb.created = new Date();

  for (const sheet of sheets) {
    const safeName = sheet.name.replace(/[\\/*?[\]:]/g, " ").slice(0, 31);
    const ws = wb.addWorksheet(safeName || "Dados");

    ws.columns = sheet.columns.map((c) => ({
      key: c.key,
      header: c.header,
      width: c.width ?? Math.min(36, Math.max(12, c.header.length + 4)),
    }));

    const headerRow = ws.getRow(1);
    headerRow.height = 22;
    headerRow.eachCell((cell) => applyHeaderStyle(cell));

    for (const row of sheet.rows) {
      const values = sheet.columns.map((c) => cellText(row[c.key]));
      const excelRow = ws.addRow(values);
      excelRow.eachCell({ includeEmpty: true }, (cell) => applyBodyStyle(cell));
    }

    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length },
    };
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function excelDownloadResponse(
  buffer: Buffer,
  filename: string,
): Response {
  const safe = filename.replace(/[^\w.\-]+/g, "_");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safe}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
