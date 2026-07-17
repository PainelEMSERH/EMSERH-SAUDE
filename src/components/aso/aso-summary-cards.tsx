import { StatusBadge } from "@/components/feedback/status-badge";
import type { CompetenceMetrics } from "@/lib/aso/indicators";
import { humanizeLabel } from "@/lib/labels";

function toneForClosure(status?: string | null) {
  switch (status) {
    case "FECHADA":
      return "danger" as const;
    case "EM_CONFERENCIA":
      return "warn" as const;
    default:
      return "ok" as const;
  }
}

function Card({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger" | "warn" | "ok";
}) {
  const toneClasses: Record<string, string> = {
    default: "text-slate-900",
    danger: "text-red-700",
    warn: "text-amber-700",
    ok: "text-teal-800",
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClasses[tone]}`}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function AsoSummaryCards({
  metrics,
  closureStatus,
}: {
  metrics: CompetenceMetrics;
  closureStatus?: string | null;
}) {
  const pct = metrics.aderenciaPercent;
  const meta = metrics.metaPercent ?? 80;
  const pctTone =
    pct == null ? "default" : pct >= meta ? "ok" : pct >= meta - 10 ? "warn" : "danger";

  return (
    <div className="mb-3 space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Card
          label="Previstos elegíveis"
          value={String(metrics.previstosElegiveis)}
          hint={`${metrics.previstosBrutos} previstos brutos`}
        />
        <Card
          label="Realizados"
          value={String(metrics.realizados)}
          hint={`${metrics.confirmadosAlterdata} confirmados`}
          tone="ok"
        />
        <Card
          label="Aderência"
          value={pct == null ? "—" : `${pct.toFixed(1)}%`}
          hint={metrics.metaPercent != null ? `Meta: ${metrics.metaPercent}%` : "Sem meta definida"}
          tone={pctTone}
        />
        <Card
          label="Faltam p/ meta"
          value={metrics.faltamParaMeta == null ? "—" : String(metrics.faltamParaMeta)}
          hint={metrics.excedente > 0 ? `Excedente: ${metrics.excedente}` : undefined}
        />
        <Card label="Justificados" value={String(metrics.justificados)} tone="warn" />
        <Card
          label="Vencidos"
          value={String(metrics.vencidos)}
          hint={`${metrics.naoRealizados} não realizados`}
          tone="danger"
        />
      </div>
      {closureStatus ? (
        <div className="flex items-center gap-2 text-[12px] text-slate-500">
          <span>Situação da competência:</span>
          <StatusBadge label={humanizeLabel(closureStatus)} tone={toneForClosure(closureStatus)} />
        </div>
      ) : null}
      <p className="text-[11px] text-slate-400">
        Fórmula: {metrics.rule.formula} — {metrics.rule.note}
      </p>
    </div>
  );
}
