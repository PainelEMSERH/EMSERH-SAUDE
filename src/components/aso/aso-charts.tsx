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
import { formatAdherencePercent } from "@/lib/aso/format-percent";

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

const PIE_LABELS: Record<string, string> = {
  confirmados: "Confirmados no Alterdata",
  pendentes: "Pendentes no Alterdata",
  naoRealizados: "Não realizados",
  justificados: "Justificados",
  vencidos: "Vencidos",
};

const PIE_SHORT: Record<string, string> = {
  confirmados: "confirmados",
  pendentes: "pendentes",
  naoRealizados: "não realizados",
  justificados: "justificados",
  vencidos: "vencidos",
};

export function AsoCharts({
  series,
  distribution,
  competenceLabel,
}: {
  series: AsoChartSeriesPoint[];
  distribution: AsoDistribution;
  competenceLabel?: string;
}) {
  const hasAnyMeta = series.some((s) => s.meta != null);
  const lineData = series.map((s) => ({
    name: s.label,
    resultado: s.resultado,
    realizados: s.realizados,
    elegiveis: s.elegiveis,
    ...(hasAnyMeta ? { meta: s.meta } : {}),
  }));

  const allPie = [
    {
      key: "confirmados",
      name: PIE_LABELS.confirmados,
      value: distribution.realizadoConfirmado,
      fill: "#0f766e",
    },
    {
      key: "pendentes",
      name: PIE_LABELS.pendentes,
      value: distribution.realizadoPendente,
      fill: "#d97706",
    },
    {
      key: "naoRealizados",
      name: PIE_LABELS.naoRealizados,
      value: distribution.naoRealizado,
      fill: "#94a3b8",
    },
    {
      key: "justificados",
      name: PIE_LABELS.justificados,
      value: distribution.justificado,
      fill: "#64748b",
    },
    {
      key: "vencidos",
      name: PIE_LABELS.vencidos,
      value: distribution.vencido,
      fill: "#b91c1c",
    },
  ];
  const pieData = allPie.filter((d) => d.value > 0);
  const dominant = pieData.reduce(
    (best, cur) => (cur.value > (best?.value ?? -1) ? cur : best),
    null as (typeof pieData)[number] | null,
  );

  return (
    <div className="mb-3 grid gap-3 lg:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="mb-2 text-[12px] font-semibold text-slate-800">
          {hasAnyMeta ? "Aderência anual × meta" : "Evolução da aderência anual"}
        </p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value, name, item) => {
                  const payload = item?.payload as {
                    realizados?: number;
                    elegiveis?: number;
                  };
                  if (name === "Meta" || name === "meta") {
                    return [`${value}%`, "Meta"];
                  }
                  return [
                    formatAdherencePercent(
                      typeof value === "number" ? value : null,
                      {
                        realizados: payload?.realizados,
                        elegiveis: payload?.elegiveis,
                      },
                    ),
                    hasAnyMeta ? "Aderência" : "Execução operacional",
                  ];
                }}
              />
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
                name={hasAnyMeta ? "Aderência" : "Execução operacional"}
                stroke="#0f766e"
                strokeWidth={2}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="mb-1 text-[12px] font-semibold text-slate-800">
          {competenceLabel
            ? `Distribuição — ${competenceLabel}`
            : "Distribuição da competência"}
        </p>
        <div className="h-52">
          {pieData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="38%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={pieData.length > 1 ? 2 : 0}
                  stroke="none"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
                </Pie>
                {dominant ? (
                  <text
                    x="38%"
                    y="47%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-slate-900"
                    style={{ fontSize: 22, fontWeight: 600 }}
                  >
                    {dominant.value}
                  </text>
                ) : null}
                {dominant ? (
                  <text
                    x="38%"
                    y="58%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-slate-500"
                    style={{ fontSize: 11 }}
                  >
                    {PIE_SHORT[dominant.key] ?? "total"}
                  </text>
                ) : null}
                <Tooltip
                  formatter={(value, name) => [`${value}`, String(name)]}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  wrapperStyle={{ fontSize: 11, lineHeight: "18px", maxWidth: "48%" }}
                  formatter={(value) => {
                    const item = pieData.find((d) => d.name === value);
                    return `${value}: ${item?.value ?? 0}`;
                  }}
                />
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
