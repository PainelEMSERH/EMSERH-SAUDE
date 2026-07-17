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
  tone: "ok" | "near" | "below" | "empty" | "future";
};

export type AsoMatrixRow = {
  key: string;
  label: string;
  regionId: string | null;
  unitId: string | null;
  cells: AsoMatrixCell[];
};

const TONE_CLASSES: Record<AsoMatrixCell["tone"], string> = {
  ok: "bg-teal-50 text-teal-800 hover:bg-teal-100",
  near: "bg-amber-50 text-amber-800 hover:bg-amber-100",
  below: "bg-red-50 text-red-800 hover:bg-red-100",
  empty: "bg-slate-50 text-slate-400 hover:bg-slate-100",
  future: "bg-white text-slate-300",
};

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
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-[13px] text-slate-500">
        Sem dados de planejamento para o período. Gere o planejamento anual.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-slate-50">
            <th className="sticky left-0 z-10 min-w-[140px] border-b border-slate-200 bg-slate-50 px-2.5 py-2 text-left font-semibold text-slate-600">
              Escopo
            </th>
            {MONTH_LABELS.map((label, idx) => (
              <th
                key={label}
                className={cn(
                  "border-b border-slate-200 px-1.5 py-2 text-center font-semibold text-slate-600",
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
            <tr key={row.key} className="border-b border-slate-100">
              <td
                className={cn(
                  "sticky left-0 z-10 whitespace-nowrap bg-white px-2.5 py-1.5 font-medium text-slate-700",
                  activeKey === row.key ? "bg-teal-50" : "",
                )}
                title={row.label}
              >
                {row.label}
              </td>
              {row.cells.map((cell) => (
                <td key={cell.month} className="p-0.5 text-center">
                  <Link
                    href={buildAsoUrl("/asos", current, {
                      month: cell.month,
                      regionId: row.regionId ?? undefined,
                      unitId: row.unitId ?? undefined,
                      page: undefined,
                    })}
                    title={
                      cell.elegiveis > 0
                        ? `${cell.realizados}/${cell.elegiveis} realizados${
                            cell.meta != null ? ` · meta ${cell.meta}%` : ""
                          }`
                        : "Sem previstos elegíveis"
                    }
                    className={cn(
                      "block rounded px-1.5 py-1 tabular-nums transition-colors",
                      TONE_CLASSES[cell.tone],
                    )}
                  >
                    {cell.percent == null ? "—" : `${cell.percent.toFixed(0)}%`}
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
