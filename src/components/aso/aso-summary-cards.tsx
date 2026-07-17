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

function Kpi({
  label,
  value,
  hint,
  tone = "default",
  href,
  compactValue,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger" | "warn" | "ok";
  href?: string;
  compactValue?: boolean;
}) {
  const toneClasses = {
    default: "text-slate-900",
    danger: "text-red-700",
    warn: "text-amber-700",
    ok: "text-teal-800",
  } as const;

  const body = (
    <div
      className={cn(
        "flex h-full min-w-0 flex-col justify-center px-3 py-2.5",
        href ? "transition-colors hover:bg-teal-50/40" : "",
      )}
    >
      <p className="text-[10px] font-semibold tracking-[0.06em] text-slate-500 uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 leading-none font-semibold tracking-tight tabular-nums",
          compactValue ? "text-[16px]" : "text-[22px]",
          toneClasses[tone],
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 truncate text-[10px] leading-tight text-slate-500" title={hint}>
          {hint}
        </p>
      ) : (
        <span className="mt-1 block h-[14px]" aria-hidden />
      )}
    </div>
  );

  return href ? <Link href={href} className="min-w-0">{body}</Link> : body;
}

function StripItem({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number | string;
  href?: string;
  tone?: "default" | "warn" | "ok" | "muted";
}) {
  const valueClass =
    tone === "warn"
      ? "text-amber-700"
      : tone === "ok"
        ? "text-teal-800"
        : tone === "muted"
          ? "text-slate-400"
          : "text-slate-800";

  const content = (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      <span className="text-slate-500">{label}</span>
      <span className={cn("font-semibold tabular-nums", valueClass)}>{value}</span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="rounded px-0.5 hover:bg-white/80 hover:text-teal-900">
        {content}
      </Link>
    );
  }
  return content;
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

  const adherenceHint = metaDefined
    ? `Meta institucional: ${metrics.metaPercent}%`
    : "Execução operacional · meta não cadastrada";

  return (
    <div className="mb-3 space-y-2">
      {asoType === "ALL" ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] text-slate-600">
          <strong className="font-semibold text-slate-800">Consolidado operacional</strong>
          {" · "}
          cada tipo de ASO possui denominador próprio.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 lg:grid-cols-4 lg:divide-y-0">
          <Kpi
            label="Elegíveis"
            value={String(metrics.previstosElegiveis)}
            hint={`${metrics.previstosBrutos} previstos brutos`}
            href={buildAsoUrl("/asos", current, { pendingOnly: "1", page: undefined })}
          />
          <Kpi
            label="Realizados"
            value={String(metrics.realizados)}
            hint={`${metrics.confirmadosAlterdata} confirmados no Alterdata`}
            tone="ok"
            href={buildAsoUrl("/asos", current, { execution: "REALIZADO", page: undefined })}
          />
          <Kpi
            label="Aderência"
            value={pctLabel}
            hint={adherenceHint}
            tone={pctTone}
          />
          {metaDefined ? (
            <Kpi
              label="Faltam para a meta"
              value={String(metrics.faltamParaMeta ?? 0)}
              hint={`Meta: ${metrics.metaPercent}%`}
              tone={
                metrics.faltamParaMeta != null && metrics.faltamParaMeta > 0 ? "warn" : "ok"
              }
            />
          ) : (
            <Kpi
              label="Meta"
              value="Não cadastrada"
              hint="Cadastro institucional pendente"
              compactValue
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 bg-slate-50/90 px-3 py-1.5 text-[11px]">
          <StripItem label="Previstos brutos" value={metrics.previstosBrutos} />
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <StripItem label="Justificados" value={metrics.justificados} tone="warn" />
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <StripItem
            label="Não realizados"
            value={metrics.naoRealizados}
            href={buildAsoUrl("/asos", current, { pendingOnly: "1", page: undefined })}
          />
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <StripItem
            label="Confirmados no Alterdata"
            value={metrics.confirmadosAlterdata}
            tone="ok"
          />
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <StripItem
            label="Pendentes no Alterdata"
            value={metrics.pendentesAlterdata}
            tone={metrics.pendentesAlterdata > 0 ? "warn" : "muted"}
            href={buildAsoUrl("/asos", current, {
              priority: "pendentesAlterdata",
              page: undefined,
            })}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 px-3 py-1.5 text-[11px]">
          <span className="font-semibold text-slate-600">Impactos da competência</span>
          <StripItem
            label="Afastados"
            value={metrics.afastados}
            tone={metrics.afastados ? "warn" : "muted"}
            href={buildAsoUrl("/asos", current, {
              functional: "AFASTADO",
              page: undefined,
            })}
          />
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <StripItem
            label="Férias"
            value={metrics.ferias}
            tone={metrics.ferias ? "default" : "muted"}
            href={buildAsoUrl("/asos", current, {
              functional: "FERIAS",
              page: undefined,
            })}
          />
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <StripItem
            label="Demitidos"
            value={metrics.demitidos}
            tone={metrics.demitidos ? "default" : "muted"}
            href={buildAsoUrl("/asos", current, {
              functional: "DEMITIDO",
              page: undefined,
            })}
          />
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <StripItem
            label="Outros justificados"
            value={metrics.outrosJustificados}
            tone={metrics.outrosJustificados ? "default" : "muted"}
          />

          {closureStatus ? (
            <>
              <span className="ml-auto hidden sm:inline" />
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                Competência
                <StatusBadge
                  label={humanizeLabel(closureStatus)}
                  tone={toneForClosure(closureStatus)}
                />
              </span>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
