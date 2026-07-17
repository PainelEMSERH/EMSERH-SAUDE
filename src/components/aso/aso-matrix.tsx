"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MONTH_LABELS, MONTH_NAMES } from "@/lib/aso/constants";
import { formatAdherencePercent } from "@/lib/aso/format-percent";
import { buildAsoUrl } from "@/lib/aso/planning";
import { cn } from "@/lib/utils";

export type AsoMatrixCell = {
  month: number;
  realizados: number;
  elegiveis: number;
  percent: number | null;
  meta: number | null;
  tone: "ok" | "near" | "below" | "empty" | "future" | "neutral";
};

export type AsoMatrixRow = {
  key: string;
  label: string;
  regionId: string | null;
  unitId: string | null;
  cadastralAlert?: boolean;
  cells: AsoMatrixCell[];
};

type Selection = {
  rowKey: string;
  label: string;
  month: number;
  regionId: string | null;
  unitId: string | null;
};

const TONE_CLASSES: Record<AsoMatrixCell["tone"], string> = {
  ok: "bg-teal-50 text-teal-800 hover:bg-teal-100",
  near: "bg-amber-50 text-amber-800 hover:bg-amber-100",
  below: "bg-red-50 text-red-800 hover:bg-red-100",
  empty: "bg-slate-50 text-slate-500 hover:bg-slate-100",
  future: "bg-sky-50/60 text-sky-700 hover:bg-sky-100",
  neutral: "bg-slate-50 text-slate-700 hover:bg-slate-100",
};

function cellLabel(cell: AsoMatrixCell): string {
  if (cell.tone === "future") return "Planejado";
  if (!cell.elegiveis) return "—";
  if (cell.percent == null) return "—";
  return formatAdherencePercent(cell.percent, {
    realizados: cell.realizados,
    elegiveis: cell.elegiveis,
  });
}

function cellSub(cell: AsoMatrixCell): string {
  if (cell.tone === "future") return "·";
  if (!cell.elegiveis) return "sem prev.";
  return `${cell.realizados}/${cell.elegiveis}`;
}

function cellTitle(cell: AsoMatrixCell): string {
  if (cell.tone === "future") return "Competência futura · Planejado";
  if (cell.elegiveis > 0) {
    const pct = formatAdherencePercent(cell.percent, {
      realizados: cell.realizados,
      elegiveis: cell.elegiveis,
    });
    if (cell.meta != null) {
      return `${cell.realizados} executados de ${cell.elegiveis} planejados · ${pct} · meta ${cell.meta}%`;
    }
    return `${cell.realizados} executados de ${cell.elegiveis} planejados · ${pct} de execução · meta não cadastrada`;
  }
  return "Sem planejados na competência";
}

function resolveInitialSelection(
  rows: AsoMatrixRow[],
  activeMonth: number,
  activeKey?: string,
): Selection | null {
  if (!rows.length) return null;
  const row =
    (activeKey ? rows.find((r) => r.key === activeKey) : null) ?? rows[0];
  return {
    rowKey: row.key,
    label: row.label,
    month: activeMonth,
    regionId: row.regionId,
    unitId: row.unitId,
  };
}

export function AsoMatrix({
  rows,
  activeMonth,
  activeKey,
  current,
  unitCount = 0,
  unitSelected = false,
}: {
  rows: AsoMatrixRow[];
  activeMonth: number;
  activeKey?: string;
  current: Record<string, string | number | undefined>;
  /** Unidades disponíveis no filtro (quando regional sem unidade). */
  unitCount?: number;
  unitSelected?: boolean;
}) {
  const initial = useMemo(
    () => resolveInitialSelection(rows, activeMonth, activeKey),
    [rows, activeMonth, activeKey],
  );
  const [selection, setSelection] = useState<Selection | null>(initial);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setSelection(resolveInitialSelection(rows, activeMonth, activeKey));
  }, [rows, activeMonth, activeKey]);

  if (!rows.length) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-[13px] text-slate-500">
        Sem dados de planejamento para o período. Gere o planejamento anual.
      </div>
    );
  }

  const selectedCell = selection
    ? rows
        .find((r) => r.key === selection.rowKey)
        ?.cells.find((c) => c.month === selection.month)
    : null;

  const openHref = selection
    ? buildAsoUrl("/asos", current, {
        month: selection.month,
        regionId: selection.regionId ?? undefined,
        unitId: selection.unitId ?? undefined,
        priority: undefined,
        page: undefined,
      })
    : null;

  const appliedMatches =
    selection != null &&
    selection.month === activeMonth &&
    selection.rowKey === (activeKey ?? rows[0]?.key);

  return (
    <div className="mb-3 w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-slate-800">
            Matriz anual
          </h3>
          <p className="text-[11px] text-slate-500">
            {unitSelected
              ? "Detalhe da unidade selecionada. Clique na célula e use Abrir competência."
              : unitCount > 1
                ? `Consolidado da regional · ${unitCount} unidades. Selecione uma unidade no filtro para ver o detalhe.`
                : "Clique para selecionar. Use Abrir competência para filtrar a página."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            {collapsed ? "Expandir matriz" : "Recolher matriz"}
          </button>
          {openHref && selection ? (
            <Link
              href={openHref}
              className={cn(
                "rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors",
                appliedMatches
                  ? "border border-teal-200 bg-teal-50 text-teal-800"
                  : "bg-teal-700 text-white hover:bg-teal-800",
              )}
            >
              {appliedMatches
                ? `Competência aberta · ${MONTH_LABELS[selection.month - 1]}`
                : `Abrir ${MONTH_NAMES[selection.month - 1]} · ${selection.label}`}
            </Link>
          ) : null}
        </div>
      </div>

      {selection && selectedCell ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 bg-slate-50/80 px-3 py-1.5 text-[11px] text-slate-600">
          <span>
            Selecionado:{" "}
            <strong className="font-semibold text-slate-800">
              {selection.label}
            </strong>{" "}
            · {MONTH_NAMES[selection.month - 1]}
          </span>
          <span className="tabular-nums text-slate-500">
            {cellTitle(selectedCell)}
          </span>
        </div>
      ) : null}

      {!unitSelected && unitCount > 1 ? (
        <div className="border-b border-teal-100 bg-teal-50/60 px-3 py-1.5 text-[11px] text-teal-900">
          Para ver a matriz por unidade, escolha a <strong>Unidade</strong> no
          filtro acima. Aqui fica só o consolidado da regional — sem lista
          interminável.
        </div>
      ) : null}

      {!collapsed ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] table-fixed border-collapse text-[11px]">
            <colgroup>
              <col className="w-[148px]" />
              {MONTH_LABELS.map((label) => (
                <col key={label} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-slate-50">
                <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-left font-semibold text-slate-600">
                  Escopo
                </th>
                {MONTH_LABELS.map((label, idx) => {
                  const month = idx + 1;
                  const headerSelected = selection?.month === month;
                  return (
                    <th
                      key={label}
                      className={cn(
                        "border-b border-slate-200 px-0 py-1.5 text-center font-semibold text-slate-600",
                        headerSelected ? "bg-teal-50 text-teal-900" : "",
                      )}
                    >
                      <button
                        type="button"
                        className="w-full px-0.5 py-0.5 hover:text-teal-800"
                        title={`Selecionar ${MONTH_NAMES[idx]} no escopo atual`}
                        onClick={() => {
                          const base =
                            rows.find((r) => r.key === selection?.rowKey) ??
                            rows.find((r) => r.key === activeKey) ??
                            rows[0];
                          setSelection({
                            rowKey: base.key,
                            label: base.label,
                            month,
                            regionId: base.regionId,
                            unitId: base.unitId,
                          });
                        }}
                      >
                        {label}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rowSelected = selection?.rowKey === row.key;
                return (
                  <tr
                    key={row.key}
                    className={cn(
                      "border-b border-slate-100",
                      row.cadastralAlert ? "bg-amber-50/30" : "",
                    )}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-10 max-w-[148px] truncate bg-white px-2 py-1 font-medium text-slate-700",
                        rowSelected ? "bg-teal-50/80" : "",
                        row.cadastralAlert ? "text-amber-900" : "",
                      )}
                      title={
                        row.cadastralAlert
                          ? "Problema cadastral: regional ausente no Alterdata"
                          : row.label
                      }
                    >
                      {row.label}
                    </td>
                    {row.cells.map((cell) => {
                      const isSelected =
                        selection?.rowKey === row.key &&
                        selection.month === cell.month;
                      const isApplied =
                        activeMonth === cell.month &&
                        (activeKey ?? rows[0]?.key) === row.key;
                      return (
                        <td key={cell.month} className="p-0.5 text-center">
                          <button
                            type="button"
                            title={cellTitle(cell)}
                            onClick={() =>
                              setSelection({
                                rowKey: row.key,
                                label: row.label,
                                month: cell.month,
                                regionId: row.regionId,
                                unitId: row.unitId,
                              })
                            }
                            className={cn(
                              "flex h-[40px] w-full flex-col items-center justify-center rounded px-0.5 leading-none transition-colors",
                              TONE_CLASSES[cell.tone],
                              isSelected
                                ? "bg-teal-100/80 ring-2 ring-teal-600 ring-offset-1"
                                : isApplied
                                  ? "ring-1 ring-teal-300"
                                  : "",
                            )}
                          >
                            <span className="text-[11px] font-semibold tabular-nums">
                              {cellLabel(cell)}
                            </span>
                            <span className="mt-0.5 text-[9px] font-normal tabular-nums opacity-75">
                              {cellSub(cell)}
                            </span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-3 py-2 text-[12px] text-slate-500">
          Matriz recolhida
          {selection
            ? ` · seleção: ${selection.label} · ${MONTH_NAMES[selection.month - 1]}`
            : ""}
          .
        </div>
      )}
    </div>
  );
}
