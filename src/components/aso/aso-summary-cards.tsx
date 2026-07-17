import Link from "next/link";
import { StatusBadge } from "@/components/feedback/status-badge";
import type { CompetenceMetrics } from "@/lib/aso/indicators";
import { buildAsoUrl } from "@/lib/aso/planning";
import { humanizeLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

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
  href,
  emphasis,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger" | "warn" | "ok";
  href?: string;
  emphasis?: boolean;
}) {
  const toneClasses: Record<string, string> = {
    default: "text-slate-900",
    danger: "text-red-700",
    warn: "text-amber-700",
    ok: "text-teal-800",
  };
  const body = (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-3",
        emphasis ? "ring-1 ring-teal-200" : "",
        href ? "transition-colors hover:border-teal-300 hover:bg-teal-50/30" : "",
      )}
    >
      <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClasses[tone]}`}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function AsoSummaryCards({
  metrics,
  closureStatus,
  current,
  asoType,
}: {
  metrics: CompetenceMetrics;
  closureStatus?: string | null;
  current: Record<string, string | number | undefined>;
  asoType: string;
}) {
  const pct = metrics.aderenciaPercent;
  const metaDefined = metrics.metaDefined && metrics.metaPercent != null;
  const pctTone =
    !metaDefined || pct == null
      ? "default"
      : pct >= metrics.metaPercent!
        ? "ok"
        : pct >= metrics.metaPercent! - 10
          ? "warn"
          : "danger";

  return (
    <div className="mb-3 space-y-2">
      {asoType === "ALL" ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
          <strong className="font-semibold text-slate-800">Consolidado operacional</strong>
          {" · "}
          cada tipo de ASO possui denominador próprio. Status: pendente de validação institucional.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Card
          label="Elegíveis"
          value={String(metrics.previstosElegiveis)}
          hint={`${metrics.previstosBrutos} brutos · ${metrics.justificados} justificados`}
          emphasis
          href={buildAsoUrl("/asos", current, { pendingOnly: "1", page: undefined })}
        />
        <Card
          label="Realizados"
          value={String(metrics.realizados)}
          hint={`${metrics.confirmadosAlterdata} confirmados no Alterdata`}
          tone="ok"
          emphasis
          href={buildAsoUrl("/asos", current, { execution: "REALIZADO", page: undefined })}
        />
        <Card
          label="Aderência"
          value={pct == null ? "—" : `${pct.toFixed(1)}%`}
          hint={
            metaDefined
              ? `Meta: ${metrics.metaPercent}%`
              : "Indicador sem parâmetro institucional"
          }
          tone={pctTone}
          emphasis
        />
        <Card
          label="Faltam p/ meta"
          value={
            !metaDefined
              ? "Meta não definida"
              : metrics.faltamParaMeta == null
                ? "—"
                : String(metrics.faltamParaMeta)
          }
          hint={
            !metaDefined
              ? "Defina uma meta para acompanhar o déficit"
              : metrics.excedente > 0
                ? `Excedente: ${metrics.excedente}`
                : undefined
          }
          tone={!metaDefined ? "warn" : "default"}
          emphasis
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card label="Previstos brutos" value={String(metrics.previstosBrutos)} />
        <Card label="Justificados" value={String(metrics.justificados)} tone="warn" />
        <Card
          label="Não realizados"
          value={String(metrics.naoRealizados)}
          href={buildAsoUrl("/asos", current, { pendingOnly: "1", page: undefined })}
        />
        <Card
          label="Confirmados Alterdata"
          value={String(metrics.confirmadosAlterdata)}
          tone="ok"
        />
        <Card
          label="Pendentes Alterdata"
          value={String(metrics.pendentesAlterdata)}
          tone="warn"
          href={buildAsoUrl("/asos", current, {
            priority: "pendentesAlterdata",
            page: undefined,
          })}
        />
      </div>

      {closureStatus ? (
        <div className="flex items-center gap-2 text-[12px] text-slate-500">
          <span>Situação da competência:</span>
          <StatusBadge label={humanizeLabel(closureStatus)} tone={toneForClosure(closureStatus)} />
        </div>
      ) : null}
    </div>
  );
}
