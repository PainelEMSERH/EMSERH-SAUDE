import Link from "next/link";
import { StatusBadge } from "@/components/feedback/status-badge";
import type { CompetenceMetrics } from "@/lib/aso/indicators";
import { formatAdherencePercent } from "@/lib/aso/format-percent";
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
  compact,
  valueClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger" | "warn" | "ok";
  href?: string;
  emphasis?: boolean;
  compact?: boolean;
  valueClassName?: string;
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
        "rounded-lg border border-slate-200 bg-white",
        compact ? "px-2.5 py-1.5" : "p-3",
        emphasis ? "ring-1 ring-teal-200" : "",
        href ? "transition-colors hover:border-teal-300 hover:bg-teal-50/30" : "",
      )}
    >
      <p
        className={cn(
          "font-medium tracking-wide text-slate-500 uppercase",
          compact ? "text-[10px]" : "text-[11px]",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "font-semibold tabular-nums",
          compact ? "mt-0.5 text-base" : "mt-1 text-2xl",
          toneClasses[tone],
          valueClassName,
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className={cn("text-slate-500", compact ? "mt-0 text-[10px]" : "mt-0.5 text-[11px]")}>
          {hint}
        </p>
      ) : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function ImpactItem({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href?: string;
  tone?: string;
}) {
  const content = (
    <div className="min-w-0">
      <p className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", tone ?? "text-slate-800")}>
        {value}
      </p>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="rounded-md px-1 py-0.5 transition-colors hover:bg-slate-50">
        {content}
      </Link>
    );
  }
  return <div className="px-1 py-0.5">{content}</div>;
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

  const pctLabel =
    pct == null
      ? "—"
      : formatAdherencePercent(pct, {
          realizados: metrics.realizados,
          elegiveis: metrics.previstosElegiveis,
        });

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
          emphasis
          href={buildAsoUrl("/asos", current, { pendingOnly: "1", page: undefined })}
        />
        <Card
          label="Realizados"
          value={String(metrics.realizados)}
          tone="ok"
          emphasis
          href={buildAsoUrl("/asos", current, { execution: "REALIZADO", page: undefined })}
        />
        <Card
          label="Aderência"
          value={
            !metaDefined && pct != null
              ? `${pctLabel} de execução operacional`
              : pctLabel
          }
          hint={
            metaDefined
              ? `Meta institucional: ${metrics.metaPercent}%`
              : "Meta institucional ainda não cadastrada"
          }
          tone={pctTone}
          emphasis
          valueClassName={!metaDefined && pct != null ? "text-lg leading-snug" : undefined}
        />
        <Card
          label={metaDefined ? "Faltam para a meta" : "Meta não definida"}
          value={
            metaDefined && metrics.faltamParaMeta != null
              ? String(metrics.faltamParaMeta)
              : "Meta não definida"
          }
          hint={
            metaDefined
              ? `Meta: ${metrics.metaPercent}%`
              : undefined
          }
          tone={
            metaDefined && metrics.faltamParaMeta != null && metrics.faltamParaMeta > 0
              ? "warn"
              : "default"
          }
          emphasis
          valueClassName={!metaDefined ? "text-base leading-snug" : undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
        <Card compact label="Previstos brutos" value={String(metrics.previstosBrutos)} />
        <Card compact label="Justificados" value={String(metrics.justificados)} tone="warn" />
        <Card
          compact
          label="Não realizados"
          value={String(metrics.naoRealizados)}
          href={buildAsoUrl("/asos", current, { pendingOnly: "1", page: undefined })}
        />
        <Card
          compact
          label="Confirmados no Alterdata"
          value={String(metrics.confirmadosAlterdata)}
          tone="ok"
        />
        <Card
          compact
          label="Pendentes no Alterdata"
          value={String(metrics.pendentesAlterdata)}
          tone="warn"
          href={buildAsoUrl("/asos", current, {
            priority: "pendentesAlterdata",
            page: undefined,
          })}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
        <p className="mb-1 text-[11px] font-semibold text-slate-700">
          Impactos da competência
        </p>
        <p className="mb-2 text-[10px] text-slate-500">
          Situações que podem afetar o planejamento e a elegibilidade nesta competência.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ImpactItem
            label="Afastados"
            value={metrics.afastados}
            tone={metrics.afastados ? "text-amber-800" : "text-slate-400"}
            href={buildAsoUrl("/asos", current, {
              functional: "AFASTADO",
              page: undefined,
            })}
          />
          <ImpactItem
            label="Férias"
            value={metrics.ferias}
            tone={metrics.ferias ? "text-sky-800" : "text-slate-400"}
            href={buildAsoUrl("/asos", current, {
              functional: "FERIAS",
              page: undefined,
            })}
          />
          <ImpactItem
            label="Demitidos"
            value={metrics.demitidos}
            tone={metrics.demitidos ? "text-slate-700" : "text-slate-400"}
            href={buildAsoUrl("/asos", current, {
              functional: "DEMITIDO",
              page: undefined,
            })}
          />
          <ImpactItem
            label="Outros justificados"
            value={metrics.outrosJustificados}
            tone={metrics.outrosJustificados ? "text-slate-600" : "text-slate-400"}
          />
        </div>
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
