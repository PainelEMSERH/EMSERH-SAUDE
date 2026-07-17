import { NextResponse } from "next/server";
import { buildReportDataset } from "@/db/queries/reports";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/session";
import {
  buildStyledWorkbook,
  excelDownloadResponse,
} from "@/lib/excel/export";
import { can } from "@/lib/permissions";
import {
  getReportDefinition,
  type ReportType,
} from "@/lib/reports/definitions";

export async function GET(
  _request: Request,
  context: { params: Promise<{ type: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !can(user, "reports", "export")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { type } = await context.params;
  const def = getReportDefinition(type);
  if (!def) {
    return NextResponse.json({ error: "Relatório inválido" }, { status: 404 });
  }

  const dataset = await buildReportDataset(user, def.key as ReportType);

  await writeAuditLog({
    user,
    action: "EXPORT",
    entityType: "report",
    entityId: type,
    metadata: { rows: dataset.rows.length, format: "xlsx" },
  });

  const buffer = await buildStyledWorkbook([
    {
      name: def.sheetName,
      columns: dataset.columns,
      rows: dataset.rows,
    },
  ]);

  return excelDownloadResponse(buffer, def.filename);
}
