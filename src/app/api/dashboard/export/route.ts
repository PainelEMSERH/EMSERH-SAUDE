import { NextResponse } from "next/server";
import { getDashboardBundle } from "@/db/queries/dashboard-bundle";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { parseDashboardFilters } from "@/lib/dashboard/params";
import { can } from "@/lib/permissions";

export async function GET(request: Request) {
  const user = await requirePermission("dashboard", "view");
  if (!can(user, "reports", "export") && !can(user, "asos", "export")) {
    return NextResponse.json({ error: "Sem permissão de exportação." }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseDashboardFilters(user, {
    year: url.searchParams.get("year") ?? undefined,
    month: url.searchParams.get("month") ?? undefined,
    regionId: url.searchParams.get("regionId") ?? undefined,
    unitId: url.searchParams.get("unitId") ?? undefined,
  });

  const data = await getDashboardBundle(user, filters);
  if (!data.configured) {
    return NextResponse.json({ error: "Banco não configurado." }, { status: 503 });
  }

  const lines = [
    ["Campo", "Valor"],
    ["Contexto", data.contextLabel],
    ["Gerado em", data.generatedAt],
    ["Colaboradores no escopo", String(data.headcount.total)],
    ["Ativos", String(data.headcount.ativos)],
    ["Afastados", String(data.headcount.afastados)],
    ["Aderência ASO", data.aso?.aderenciaLabel ?? "—"],
    ["Elegíveis ASO", String(data.aso?.previstosElegiveis ?? "")],
    ["Realizados ASO", String(data.aso?.realizados ?? "")],
    ["Vencidos ASO", String(data.aso?.vencidos ?? "")],
    ["Pendentes Alterdata", String(data.aso?.pendentesAlterdata ?? "")],
    ["Afastamentos ativos", String(data.leave.ativos)],
    ["ASO retorno pendente", String(data.leave.asoRetornoPendentes)],
    ["Pendências críticas", String(data.critical)],
    ["Sem regional", String(data.quality.semRegional)],
    ["Sem unidade", String(data.quality.semUnidade)],
  ];

  const csv = lines
    .map((row) =>
      row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";"),
    )
    .join("\n");

  await writeAuditLog({
    user,
    action: "EXPORT",
    entityType: "dashboard_summary",
    metadata: { filters },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dashboard-${filters.year}-${filters.month}.csv"`,
    },
  });
}
