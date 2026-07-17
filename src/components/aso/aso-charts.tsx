"use client";

import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type AsoChartSeriesPoint = {
  month: number;
  label: string;
  resultado: number | null;
  meta: number | null;
  realizados: number;
  elegiveis: number;
};

export type AsoDistribution = {
  realizadoConfirmado: number;
  realizadoPendente: number;
  naoRealizado: number;
  justificado: number;
  vencido: number;
};

export function AsoCharts({
  series,
  distribution,
}: {
  series: AsoChartSeriesPoint[];
  distribution: AsoDistribution;
}) {
  const hasAnyMeta = series.some((s) => s.meta != null);
  const lineData = series.map((s) => ({
    name: s.label,
    resultado: s.resultado,
    ...(hasAnyMeta ? { meta: s.meta } : {}),
  }));

  const pieData = [
    { name: "Confirmado Alterdata", value: distribution.realizadoConfirmado, fill: "#0f766e" },
    { name: "Pendente Alterdata", value: distribution.realizadoPendente, fill: "#d97706" },
    { name: "Não realizado", value: distribution.naoRealizado, fill: "#94a3b8" },
    { name: "Justificado", value: distribution.justificado, fill: "#64748b" },
    { name: "Vencido", value: distribution.vencido, fill: "#b91c1c" },
  ].filter((d) => d.value > 0);

  return (
    <div className="mb-3 grid gap-3 lg:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="mb-2 text-[12px] font-semibold text-slate-800">
          Aderência anual × meta
        </p>
        {!hasAnyMeta ? (
          <p className="mb-2 text-[11px] text-amber-700">
            Sem meta cadastrada — linha de meta não exibida.
          </p>
        ) : null}
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {hasAnyMeta ? (
                <Line
                  type="monotone"
                  dataKey="meta"
                  name="Meta"
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls={false}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="resultado"
                name="Resultado"
                stroke="#0f766e"
                strokeWidth={2}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="mb-2 text-[12px] font-semibold text-slate-800">
          Distribuição da competência
        </p>
        <div className="h-56">
          {pieData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-[12px] text-slate-500">
              Sem dados na competência.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
