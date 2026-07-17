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

function cellLabel(cell: AsoMatrixCell): string {
  if (cell.tone === "future") return "—";
  if (!cell.elegiveis) return "—";
  if (cell.percent == null) return "—";
  return formatAdherencePercent(cell.percent, {
    realizados: cell.realizados,
    elegiveis: cell.elegiveis,
  });
}

function cellSub(cell: AsoMatrixCell): string {
  if (cell.tone === "future") return "Planejado";
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

function toneText(tone: AsoMatrixCell["tone"]) {
  switch (tone) {
    case "near":
      return "text-amber-700";
    case "below":
      return "text-red-700";
    case "future":
    case "empty":
      return "text-slate-400";
    default:
      return "text-slate-800";
  }
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
      <div className="flex min-h-[140px] items-center justify-center rounded-xl border border-dashed border-border bg-card text-[13px] text-muted-foreground">
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

  const selectedPct =
    selectedCell && selectedCell.elegiveis > 0 && selectedCell.percent != null
      ? formatAdherencePercent(selectedCell.percent, {
          realizados: selectedCell.realizados,
          elegiveis: selectedCell.elegiveis,
        })
      : null;

  return (
    <section className="app-surface mb-4 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">
            Matriz anual
          </h3>
          <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-slate-500">
            {unitSelected
              ? "Detalhe da unidade. Clique numa célula e abra a competência."
              : unitCount > 1
                ? `Consolidado da regional · ${unitCount} unidades. Filtre por unidade para o detalhe.`
                : "Clique numa célula para selecionar a competência."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="h-8 rounded-lg border border-border bg-white px-3 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            {collapsed ? "Expandir" : "Recolher"}
          </button>
          {openHref && selection ? (
            <Link
              href={openHref}
              className={cn(
                "inline-flex h-8 items-center rounded-lg px-3.5 text-[12px] font-semibold transition-colors",
                appliedMatches
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "bg-primary text-primary-foreground hover:bg-primary-hover",
              )}
            >
              {appliedMatches
                ? `Aberta · ${MONTH_LABELS[selection.month - 1]}`
                : `Abrir ${MONTH_NAMES[selection.month - 1]}`}
            </Link>
          ) : null}
        </div>
      </div>

      {/* Selection summary */}
      {selection && selectedCell ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border-subtle bg-gradient-to-r from-slate-50 to-white px-5 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.08em] text-slate-400 uppercase">
              Seleção
            </p>
            <p className="mt-0.5 text-[13px] font-semibold text-slate-900">
              {selection.label}
              <span className="font-normal text-slate-400"> · </span>
              {MONTH_NAMES[selection.month - 1]}
            </p>
          </div>
          {selectedPct ? (
            <div className="flex items-baseline gap-3">
              <span
                className={cn(
                  "text-[22px] font-semibold tracking-tight tabular-nums",
                  toneText(selectedCell.tone),
                )}
              >
                {selectedPct}
              </span>
              <span className="text-[12px] tabular-nums text-slate-500">
                {selectedCell.realizados}
                <span className="text-slate-300"> / </span>
                {selectedCell.elegiveis}
                {selectedCell.meta != null ? (
                  <span className="ml-2 text-slate-400">
                    meta {selectedCell.meta}%
                  </span>
                ) : null}
              </span>
            </div>
          ) : (
            <p className="text-[12.5px] text-slate-500">
              {cellTitle(selectedCell)}
            </p>
          )}
        </div>
      ) : null}

      {!unitSelected && unitCount > 1 ? (
        <div className="border-b border-border-subtle bg-amber-50/60 px-5 py-2.5 text-[12px] text-amber-900/80">
          Para ver por unidade, escolha a{" "}
          <strong className="font-semibold">Unidade</strong> no filtro. Aqui
          fica só o consolidado da regional.
        </div>
      ) : null}

      {!collapsed ? (
        <div className="overflow-x-auto p-3 sm:p-4">
          <div
            className="min-w-[760px]"
            style={{
              display: "grid",
              gridTemplateColumns: `132px repeat(${MONTH_LABELS.length}, minmax(52px, 1fr))`,
              gap: "4px",
            }}
          >
            {/* Column headers */}
            <div className="flex h-9 items-end px-2 pb-1 text-[10px] font-semibold tracking-[0.08em] text-slate-400 uppercase">
              Escopo
            </div>
            {MONTH_LABELS.map((label, idx) => {
              const month = idx + 1;
              const headerSelected = selection?.month === month;
              return (
                <button
                  key={label}
                  type="button"
                  title={`Selecionar ${MONTH_NAMES[idx]}`}
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
                  className={cn(
                    "flex h-9 items-end justify-center rounded-t-md pb-1.5 text-[11px] font-semibold tracking-wide transition-colors",
                    headerSelected
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-slate-400 hover:bg-slate-50 hover:text-slate-700",
                  )}
                >
                  {label}
                </button>
              );
            })}

            {/* Rows */}
            {rows.map((row) => {
              const rowSelected = selection?.rowKey === row.key;
              return (
                <div key={row.key} className="contents">
                  <div
                    className={cn(
                      "flex items-center rounded-lg px-3 text-[12.5px] font-semibold tracking-tight",
                      row.cadastralAlert
                        ? "bg-amber-50 text-amber-800"
                        : rowSelected
                          ? "bg-emerald-50/80 text-emerald-900"
                          : "bg-slate-50 text-slate-700",
                    )}
                    title={
                      row.cadastralAlert
                        ? "Problema cadastral: regional ausente no Alterdata"
                        : row.label
                    }
                  >
                    <span className="truncate">{row.label}</span>
                  </div>

                  {row.cells.map((cell) => {
                    const isSelected =
                      selection?.rowKey === row.key &&
                      selection.month === cell.month;
                    const isApplied =
                      activeMonth === cell.month &&
                      (activeKey ?? rows[0]?.key) === row.key;
                    const isFuture = cell.tone === "future";
                    const colSelected = selection?.month === cell.month;

                    return (
                      <button
                        key={cell.month}
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
                          "group relative flex h-[52px] flex-col items-center justify-center rounded-lg px-1 transition-all duration-150",
                          isFuture
                            ? "bg-slate-50/80 text-slate-400"
                            : colSelected && !isSelected
                              ? "bg-emerald-50/40"
                              : "bg-white hover:bg-slate-50",
                          isSelected &&
                            "bg-emerald-50 ring-2 ring-emerald-500/35 ring-offset-1 ring-offset-white",
                          isApplied &&
                            !isSelected &&
                            "ring-1 ring-emerald-400/40",
                        )}
                      >
                        <span
                          className={cn(
                            "text-[12.5px] font-semibold tabular-nums leading-none tracking-tight",
                            isFuture
                              ? "text-slate-300"
                              : toneText(cell.tone),
                          )}
                        >
                          {cellLabel(cell)}
                        </span>
                        <span
                          className={cn(
                            "mt-1 text-[9.5px] leading-none tabular-nums",
                            isFuture
                              ? "font-medium tracking-wide text-slate-300 uppercase"
                              : "text-slate-400",
                          )}
                        >
                          {cellSub(cell)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="px-5 py-4 text-[13px] text-slate-500">
          Matriz recolhida
          {selection
            ? ` · ${selection.label} · ${MONTH_NAMES[selection.month - 1]}`
            : ""}
        </div>
      )}
    </section>
  );
}
