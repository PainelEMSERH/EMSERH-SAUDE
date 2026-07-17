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

/** Dados normais neutros; cor só em atenção/abaixo da meta. */
const TONE_CLASSES: Record<AsoMatrixCell["tone"], string> = {
  ok: "bg-transparent text-foreground hover:bg-muted/60",
  near: "bg-transparent text-[color:var(--warning)] hover:bg-amber-500/10",
  below: "bg-transparent text-[color:var(--danger)] hover:bg-red-500/10",
  empty: "bg-transparent text-muted-foreground hover:bg-muted/50",
  future: "bg-muted/40 text-muted-foreground hover:bg-muted/60",
  neutral: "bg-transparent text-foreground/80 hover:bg-muted/50",
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
      <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-card text-[13px] text-muted-foreground">
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
    <div className="app-surface mb-3 w-full overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border-subtle px-3 py-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-foreground">
            Matriz anual
          </h3>
          <p className="text-[11px] text-muted-foreground">
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
            className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
          >
            {collapsed ? "Expandir matriz" : "Recolher matriz"}
          </button>
          {openHref && selection ? (
            <Link
              href={openHref}
              className={cn(
                "rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors",
                appliedMatches
                  ? "border border-border bg-card text-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary-hover",
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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-subtle bg-muted/80 px-3 py-1.5 text-[11px] text-muted-foreground">
          <span>
            Selecionado:{" "}
            <strong className="font-semibold text-foreground">
              {selection.label}
            </strong>{" "}
            · {MONTH_NAMES[selection.month - 1]}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {cellTitle(selectedCell)}
          </span>
        </div>
      ) : null}

      {!unitSelected && unitCount > 1 ? (
        <div className="border-b border-border bg-muted/60 px-3 py-1.5 text-[11px] text-muted-foreground">
          Para ver a matriz por unidade, escolha a <strong className="text-foreground">Unidade</strong> no
          filtro acima. Aqui fica só o consolidado da regional — sem lista
          interminável.
        </div>
      ) : null}

      {!collapsed ? (
        <table className="app-data-table">
          <colgroup>
            <col className="w-[148px]" />
            {MONTH_LABELS.map((label) => (
              <col key={label} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[#f8fafc] text-left">
                Escopo
              </th>
              {MONTH_LABELS.map((label, idx) => {
                const month = idx + 1;
                const headerSelected = selection?.month === month;
                return (
                  <th
                    key={label}
                    className={cn(
                      "text-center",
                      headerSelected ? "bg-muted text-foreground" : "",
                    )}
                  >
                    <button
                      type="button"
                      className="w-full !px-0.5 !py-0.5 !text-[10px] !font-semibold hover:text-foreground"
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
                    row.cadastralAlert
                      ? "bg-amber-50/40"
                      : "",
                  )}
                >
                  <td
                    className={cn(
                      "sticky left-0 z-10 max-w-[148px] truncate bg-card",
                      "app-table-emphasis text-foreground/80",
                      rowSelected ? "bg-muted" : "",
                      row.cadastralAlert
                        ? "text-[color:var(--warning)]"
                        : "",
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
                      <td key={cell.month} className="!p-0.5 text-center">
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
                            "flex h-[40px] w-full flex-col items-center justify-center rounded !px-0.5 leading-none transition-colors",
                            TONE_CLASSES[cell.tone],
                            isSelected
                              ? "bg-primary-soft/80 outline outline-1 outline-primary/50"
                              : isApplied
                                ? "outline outline-1 outline-primary/35"
                                : "",
                          )}
                        >
                          <span className="app-table-num text-[11px] font-semibold">
                            {cellLabel(cell)}
                          </span>
                          <span className="app-table-meta mt-0.5 opacity-75">
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
      ) : (
        <div className="px-3 py-2 text-[12px] text-muted-foreground">
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
