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

function cellTooltip(
  row: AsoMatrixRow,
  cell: AsoMatrixCell,
  year: number,
): string {
  const monthName = MONTH_NAMES[cell.month - 1];
  const head = `${row.label} · ${monthName}/${year}`;

  if (cell.tone === "future") {
    return `${head}\nCompetência futura · Planejado`;
  }
  if (!cell.elegiveis || cell.percent == null) {
    return `${head}\nSem planejados na competência`;
  }

  const pct = formatAdherencePercent(cell.percent, {
    realizados: cell.realizados,
    elegiveis: cell.elegiveis,
  });
  return `${head}\n${cell.realizados} realizados de ${cell.elegiveis} elegíveis\n${pct} de execução`;
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
    case "below":
      return "text-red-800";
    case "ok":
      return "text-emerald-800";
    case "future":
    case "empty":
      return "text-slate-400";
    default:
      return "text-slate-800";
  }
}

function isEmserhRow(row: AsoMatrixRow) {
  return (
    !row.regionId &&
    !row.unitId &&
    row.label.toUpperCase().includes("EMSERH")
  );
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

  const year = Number(current.year) || new Date().getFullYear();

  if (!rows.length) {
    return (
      <div className="flex min-h-[140px] items-center justify-center rounded-[11px] border border-dashed border-border bg-card text-[13px] text-muted-foreground">
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
    <section className="mb-4 overflow-hidden rounded-[11px] border border-[rgba(0,0,0,0.10)] bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef1f4] px-5 py-3.5">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-[#0b1220]">
            Matriz anual
          </h3>
          <p className="mt-0.5 max-w-xl text-[12px] leading-relaxed text-[#64748b]">
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
            className="h-8 rounded-lg border border-[rgba(0,0,0,0.10)] bg-white px-3 text-[12px] font-medium text-[#64748b] transition-colors hover:bg-[#f8fafc]"
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

      {selection && selectedCell ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[#eef1f4] bg-[#f8fafc] px-5 py-2.5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.08em] text-[#94a3b8] uppercase">
              Seleção
            </p>
            <p className="mt-0.5 text-[13px] font-semibold text-[#0b1220]">
              {selection.label}
              <span className="font-normal text-[#94a3b8]"> · </span>
              {MONTH_NAMES[selection.month - 1]}/{year}
            </p>
          </div>
          {selectedPct ? (
            <div className="flex items-baseline gap-3">
              <span
                className={cn(
                  "text-[20px] font-semibold tracking-tight tabular-nums",
                  toneText(selectedCell.tone),
                )}
              >
                {selectedPct}
              </span>
              <span className="text-[12px] tabular-nums text-[#64748b]">
                {selectedCell.realizados}
                <span className="text-[#cbd5e1]"> / </span>
                {selectedCell.elegiveis}
                {selectedCell.meta != null ? (
                  <span className="ml-2 text-[#94a3b8]">
                    meta {selectedCell.meta}%
                  </span>
                ) : null}
              </span>
            </div>
          ) : (
            <p className="text-[12.5px] text-[#64748b]">
              {cellTitle(selectedCell)}
            </p>
          )}
        </div>
      ) : null}

      {!unitSelected && unitCount > 1 ? (
        <div className="border-b border-[#eef1f4] bg-amber-50/70 px-5 py-2 text-[12px] text-amber-900/80">
          Para ver por unidade, escolha a{" "}
          <strong className="font-semibold">Unidade</strong> no filtro. Aqui
          fica só o consolidado da regional.
        </div>
      ) : null}

      {!collapsed ? (
        <div className="aso-matrix-wrap">
          <table className="aso-matrix-table">
            <colgroup>
              <col className="aso-mx-scope" />
              {MONTH_LABELS.map((label) => (
                <col key={label} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="aso-mx-scope-h" scope="col">
                  Escopo
                </th>
                {MONTH_LABELS.map((label, idx) => {
                  const month = idx + 1;
                  const headerSelected = selection?.month === month;
                  return (
                    <th
                      key={label}
                      scope="col"
                      className={cn(headerSelected && "aso-mx-col-sel")}
                    >
                      <button
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
                const emserh = isEmserhRow(row);
                return (
                  <tr
                    key={row.key}
                    className={cn(emserh && "aso-mx-emserh")}
                  >
                    <td
                      className={cn(
                        "aso-mx-scope-c",
                        row.cadastralAlert && "text-amber-800",
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
                      const colSelected = selection?.month === cell.month;

                      return (
                        <td
                          key={cell.month}
                          className={cn(colSelected && "aso-mx-col-sel")}
                        >
                          <button
                            type="button"
                            data-tone={cell.tone}
                            title={cellTooltip(row, cell, year)}
                            aria-pressed={isSelected}
                            onClick={() =>
                              setSelection({
                                rowKey: row.key,
                                label: row.label,
                                month: cell.month,
                                regionId: row.regionId,
                                unitId: row.unitId,
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key !== "Enter" && e.key !== " ") return;
                              e.preventDefault();
                              setSelection({
                                rowKey: row.key,
                                label: row.label,
                                month: cell.month,
                                regionId: row.regionId,
                                unitId: row.unitId,
                              });
                            }}
                            className={cn(
                              "aso-mx-cell",
                              isSelected && "is-selected",
                              isApplied && "is-applied",
                            )}
                          >
                            {isSelected ? (
                              <span className="aso-mx-dot" aria-hidden />
                            ) : null}
                            <span className="aso-mx-pct">{cellLabel(cell)}</span>
                            <span className="aso-mx-sub">{cellSub(cell)}</span>
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
        <div className="px-5 py-4 text-[13px] text-[#64748b]">
          Matriz recolhida
          {selection
            ? ` · ${selection.label} · ${MONTH_NAMES[selection.month - 1]}/${year}`
            : ""}
        </div>
      )}
    </section>
  );
}
