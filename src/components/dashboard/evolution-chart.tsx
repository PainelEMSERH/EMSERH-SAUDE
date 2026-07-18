"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MONTH_LABELS } from "@/lib/aso/constants";

type Point = {
  month: number;
  percent: number | null;
  realizados: number;
  elegiveis: number;
  tone: string;
};

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: Point & { label: string } }>;
}) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  if (p.tone === "future") {
    return (
      <div className="rounded-lg border border-border bg-white px-3 py-2 text-[12px] shadow-sm">
        <p className="font-semibold text-slate-800">{p.label}</p>
        <p className="mt-0.5 text-slate-500">Competência futura</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 text-[12px] shadow-sm">
      <p className="font-semibold text-slate-800">{p.label}</p>
      <p className="mt-1 tabular-nums text-slate-700">
        Aderência{" "}
        <span className="font-semibold text-emerald-800">
          {p.percent == null ? "—" : `${p.percent}%`}
        </span>
      </p>
      <p className="mt-0.5 tabular-nums text-slate-500">
        {p.realizados}/{p.elegiveis} elegíveis
      </p>
    </div>
  );
}

export function DashboardEvolutionChart({ points }: { points: Point[] }) {
  const data = points.map((p) => ({
    ...p,
    label: MONTH_LABELS[p.month - 1],
    aderencia: p.tone === "future" ? null : (p.percent ?? 0),
  }));

  if (!data.length) {
    return (
      <p className="py-10 text-center text-[13px] text-slate-500">
        Sem série mensal para o escopo selecionado.
      </p>
    );
  }

  return (
    <div className="h-[260px] w-full pt-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#eef2f6"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            cursor={{ fill: "rgba(5, 150, 105, 0.06)" }}
            content={<ChartTooltip />}
          />
          <Bar dataKey="aderencia" radius={[5, 5, 0, 0]} maxBarSize={26}>
            {data.map((entry) => {
              const fill =
                entry.tone === "future" || entry.tone === "empty"
                  ? "#e2e8f0"
                  : entry.tone === "below" || entry.tone === "danger"
                    ? "#dc2626"
                    : entry.tone === "near" || entry.tone === "warn"
                      ? "#d97706"
                      : entry.tone === "ok"
                        ? "#059669"
                        : entry.percent != null && entry.percent < 70
                          ? "#dc2626"
                          : entry.percent != null && entry.percent < 90
                            ? "#d97706"
                            : "#059669";
              return (
                <Cell
                  key={entry.month}
                  fill={fill}
                  fillOpacity={
                    entry.tone === "future" || entry.tone === "empty" ? 0.5 : 1
                  }
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
