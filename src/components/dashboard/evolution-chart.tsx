"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MONTH_LABELS } from "@/lib/aso/constants";

export function DashboardEvolutionChart({
  points,
}: {
  points: Array<{
    month: number;
    percent: number | null;
    realizados: number;
    elegiveis: number;
    tone: string;
  }>;
}) {
  const data = points.map((p) => ({
    label: MONTH_LABELS[p.month - 1],
    aderencia: p.tone === "future" ? null : p.percent,
    planejado: p.tone === "future",
  }));

  if (!data.length) {
    return (
      <p className="py-8 text-center text-[13px] text-slate-500">
        Sem série mensal para o escopo selecionado.
      </p>
    );
  }

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef1f4" vertical={false} />
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
            width={36}
          />
          <Tooltip
            formatter={(value) =>
              value == null ? ["Planejado", "Aderência"] : [`${value}%`, "Aderência"]
            }
            contentStyle={{
              borderRadius: 8,
              borderColor: "#e2e8f0",
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="aderencia"
            fill="#059669"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
