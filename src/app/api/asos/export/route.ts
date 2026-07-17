import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requirePermission, userCan } from "@/lib/auth/guard";
import { getAsoPanelData } from "@/db/queries/aso-panel";
import { ASO_ADHERENCE_RULE, MONTH_NAMES } from "@/lib/aso/constants";
import { humanizeLabel } from "@/lib/labels";

export async function GET(request: Request) {
  const user = await requirePermission("asos", "view");
  const canExport =
    userCan(user, "asos", "export") || userCan(user, "reports", "export");
  if (!canExport) {
    return NextResponse.json({ error: "Sem permissão de exportação." }, { status: 403 });
  }

  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const data = await getAsoPanelData(user, params);
  const m = data.metrics;

  const memory = [
    {
      indicador: "ASO_ADERENCIA",
      formula: ASO_ADHERENCE_RULE.formula,
      competencia: `${MONTH_NAMES[data.month - 1]}/${data.year}`,
      regional: data.regionId || "EMSERH",
      unidade: data.unitId || "—",
      tipo: data.asoType,
      perspectiva: data.mode,
      previstos_brutos: m.previstosBrutos,
      justificados: m.justificados,
      previstos_elegiveis: m.previstosElegiveis,
      realizados: m.realizados,
      confirmados_alterdata: m.confirmadosAlterdata,
      pendentes_alterdata: m.pendentesAlterdata,
      percentual: m.aderenciaPercent,
      meta: m.metaPercent,
      faltam_para_meta: m.faltamParaMeta,
      numerador: m.numerador,
      denominador: m.denominador,
      gerado_em: new Date().toISOString(),
    },
  ];

  const matrixSheet = data.matrixRows.map((row) => {
    const out: Record<string, string | number> = { Escopo: row.label };
    for (const cell of row.cells) {
      out[MONTH_NAMES[cell.month - 1]] =
        cell.percent == null
          ? `— (${cell.realizados}/${cell.elegiveis})`
          : `${cell.percent}% (${cell.realizados}/${cell.elegiveis})`;
    }
    return out;
  });

  const nominalSheet = data.nominal.rows.map((r) => ({
    Colaborador: r.employeeName,
    Matricula: r.registration,
    Unidade: r.unitNameSnapshot ?? "",
    Regional: r.regionNameSnapshot ?? "",
    Tipo: humanizeLabel(r.asoType),
    Previsto: r.expectedDate ?? "",
    Competencia: `${r.month}/${r.year}`,
    Situacao_funcional: humanizeLabel(r.functionalStatusSnapshot),
    Execucao: humanizeLabel(r.executionStatus),
    Realizado: r.performedDate ?? "",
    Resultado: humanizeLabel(r.result),
    Alterdata: humanizeLabel(r.alterdataStatus),
    Proximo_ASO: r.nextAsoDate ?? "",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(memory),
    "Memoria_calculo",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(matrixSheet),
    "Matriz_anual",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(nominalSheet),
    "Relacao_nominal",
  );

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="asos-${data.year}-${data.month}.xlsx"`,
    },
  });
}
