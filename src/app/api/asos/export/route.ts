import { getAsoPanelData } from "@/db/queries/aso-panel";
import { requirePermission, userCan } from "@/lib/auth/guard";
import { MONTH_NAMES } from "@/lib/aso/constants";
import { formatAdherencePercent } from "@/lib/aso/format-percent";
import {
  buildStyledWorkbook,
  excelDownloadResponse,
} from "@/lib/excel/export";
import { formatUnitDisplayName, humanizeLabel } from "@/lib/labels";

/**
 * Export ASO da competência aberta: 1 aba só (relação nominal completa).
 * Sem abas extras — a matriz fica na tela.
 */
export async function GET(request: Request) {
  const user = await requirePermission("asos", "view");
  const canExport =
    userCan(user, "asos", "export") || userCan(user, "reports", "export");
  if (!canExport) {
    return Response.json(
      { error: "Sem permissão de exportação." },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const data = await getAsoPanelData(user, params);

  const rows = data.nominal.rows.map((r) => ({
    colaborador: r.employeeName,
    matricula: r.registration,
    unidade: formatUnitDisplayName(r.unitNameSnapshot, ""),
    regional: r.regionNameSnapshot ?? "",
    tipo: humanizeLabel(r.asoType),
    previsto: r.expectedDate ?? "",
    competencia: `${MONTH_NAMES[r.month - 1]}/${r.year}`,
    situacao_funcional: humanizeLabel(r.functionalStatusSnapshot),
    execucao: humanizeLabel(r.executionStatus),
    realizado: r.performedDate ?? "",
    resultado: humanizeLabel(r.result),
    alterdata: humanizeLabel(r.alterdataStatus),
    proximo_aso: r.nextAsoDate ?? "",
    aderencia_competencia: formatAdherencePercent(data.metrics.aderenciaPercent, {
      realizados: data.metrics.realizados,
      elegiveis: data.metrics.previstosElegiveis,
    }),
  }));

  const buffer = await buildStyledWorkbook([
    {
      name: "Relacao_nominal",
      columns: [
        { key: "colaborador", header: "Colaborador", width: 34 },
        { key: "matricula", header: "Matrícula", width: 12 },
        { key: "unidade", header: "Unidade", width: 28 },
        { key: "regional", header: "Regional", width: 16 },
        { key: "tipo", header: "Tipo", width: 14 },
        { key: "previsto", header: "Previsto", width: 12 },
        { key: "competencia", header: "Competência", width: 14 },
        { key: "situacao_funcional", header: "Sit. funcional", width: 14 },
        { key: "execucao", header: "Execução", width: 14 },
        { key: "realizado", header: "Realizado", width: 12 },
        { key: "resultado", header: "Resultado", width: 18 },
        { key: "alterdata", header: "Alterdata", width: 18 },
        { key: "proximo_aso", header: "Próximo ASO", width: 12 },
        {
          key: "aderencia_competencia",
          header: "Aderência competência",
          width: 16,
        },
      ],
      rows,
    },
  ]);

  return excelDownloadResponse(
    buffer,
    `asos-${data.year}-${String(data.month).padStart(2, "0")}.xlsx`,
  );
}
