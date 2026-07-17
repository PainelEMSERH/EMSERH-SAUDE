"use client";

import Link from "next/link";
import { MONTH_LABELS } from "@/lib/aso/constants";
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
  if (!cell.elegiveis) return "Sem previsão";
  if (cell.percent == null) return "—";
  return `${cell.percent.toFixed(0)}%`;
}

export function AsoMatrix({
  rows,
  activeMonth,
  activeKey,
  current,
}: {
  rows: AsoMatrixRow[];
  activeMonth: number;
  activeKey?: string;
  current: Record<string, string | number | undefined>;
}) {
  if (!rows.length) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-[13px] text-slate-500">
        Sem dados de planejamento para o período. Gere o planejamento anual.
      </div>
    );
  }

  return (
    <div className="mb-3 w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-3 py-2">
        <h3 className="text-[13px] font-semibold text-slate-800">Matriz anual</h3>
        <p className="text-[11px] text-slate-500">
          Clique na célula para abrir a competência. Sem meta cadastrada, o tom permanece neutro.
        </p>
      </div>
      <table className="w-full table-fixed border-collapse text-[12px]">
        <colgroup>
          <col className="w-[14%]" />
          {MONTH_LABELS.map((label) => (
            <col key={label} className="w-[7.166%]" />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-slate-50">
            <th className="border-b border-slate-200 px-2 py-2 text-left font-semibold text-slate-600">
              Escopo
            </th>
            {MONTH_LABELS.map((label, idx) => (
              <th
                key={label}
                className={cn(
                  "border-b border-slate-200 px-0.5 py-2 text-center font-semibold text-slate-600",
                  activeMonth === idx + 1 ? "bg-teal-100" : "",
                )}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={cn(
                "border-b border-slate-100",
                row.cadastralAlert ? "bg-amber-50/40" : "",
              )}
            >
              <td
                className={cn(
                  "px-2 py-1.5 font-medium text-slate-700",
                  activeKey === row.key ? "bg-teal-50" : "",
                  row.cadastralAlert ? "text-amber-900" : "",
                )}
                title={
                  row.cadastralAlert
                    ? "Problema cadastral: regional ausente no Alterdata"
                    : row.label
                }
              >
                <span className="line-clamp-2 leading-snug">{row.label}</span>
                {row.cadastralAlert ? (
                  <span className="mt-0.5 block text-[10px] font-normal text-amber-700">
                    Qualidade cadastral
                  </span>
                ) : null}
              </td>
              {row.cells.map((cell) => (
                <td
                  key={cell.month}
                  className={cn(
                    "p-0.5 text-center",
                    activeMonth === cell.month ? "bg-teal-50/40" : "",
                  )}
                >
                  <Link
                    href={buildAsoUrl("/asos", current, {
                      month: cell.month,
                      regionId: row.regionId ?? undefined,
                      unitId: row.unitId ?? undefined,
                      page: undefined,
                    })}
                    title={
                      cell.tone === "future"
                        ? "Competência futura"
                        : cell.elegiveis > 0
                          ? `${cell.realizados}/${cell.elegiveis} realizados${
                              cell.meta != null ? ` · meta ${cell.meta}%` : " · sem meta"
                            }`
                          : "Sem previstos elegíveis"
                    }
                    className={cn(
                      "block rounded px-0.5 py-1 transition-colors",
                      TONE_CLASSES[cell.tone],
                      activeMonth === cell.month ? "ring-1 ring-teal-300" : "",
                    )}
                  >
                    <span className="block text-[12px] font-semibold tabular-nums leading-tight">
                      {cellLabel(cell)}
                    </span>
                    {cell.tone !== "future" && cell.elegiveis > 0 ? (
                      <span className="block text-[9px] font-normal tabular-nums leading-tight opacity-80">
                        {cell.realizados}/{cell.elegiveis}
                      </span>
                    ) : null}
                  </Link>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
