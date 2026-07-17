import Link from "next/link";
import type { BiologicalMetrics } from "@/db/queries/occupational";
import { buildBiologicalUrl } from "@/lib/biological/constants";
import { cn } from "@/lib/utils";

function Kpi({
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger" | "warn" | "ok";
  href?: string;
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
        "flex h-full min-w-0 flex-col justify-center px-2.5 py-2.5 sm:px-3",
        href ? "transition-colors hover:bg-teal-50/40" : "",
      )}
    >
      <p className="text-[10px] font-semibold tracking-[0.05em] text-slate-500 uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-[20px] leading-none font-semibold tracking-tight tabular-nums sm:text-[22px]",
          toneClasses[tone],
        )}
      >
        {value}
      </p>
      {hint ? (
        <p
          className="mt-1 truncate text-[10px] leading-tight text-slate-500"
          title={hint}
        >
          {hint}
        </p>
      ) : (
        <span className="mt-1 block h-[14px]" aria-hidden />
      )}
    </div>
  );

  return href ? <Link href={href} className="min-w-0">{body}</Link> : body;
}

export function BiologicalSummaryCards({
  metrics,
  current,
}: {
  metrics: BiologicalMetrics;
  current: Record<string, string | number | undefined>;
}) {
  return (
    <div className="mb-3">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
          <Kpi
            label="Acidentes"
            value={String(metrics.total)}
            hint="No filtro atual"
            href={buildBiologicalUrl("/material-biologico", current, {
              status: undefined,
              pep: undefined,
              followup: undefined,
              page: undefined,
            })}
          />
          <Kpi
            label="Em acomp."
            value={String(metrics.emAcompanhamento)}
            tone={metrics.emAcompanhamento > 0 ? "warn" : "ok"}
            href={buildBiologicalUrl("/material-biologico", current, {
              status: "EM_ACOMPANHAMENTO",
              followup: undefined,
              page: undefined,
            })}
          />
          <Kpi
            label="Concluídos"
            value={String(metrics.concluidos)}
            tone="ok"
            href={buildBiologicalUrl("/material-biologico", current, {
              status: "CONCLUIDO",
              followup: undefined,
              page: undefined,
            })}
          />
          <Kpi
            label="Com PEP"
            value={String(metrics.comPep)}
            href={buildBiologicalUrl("/material-biologico", current, {
              pep: "1",
              page: undefined,
            })}
          />
          <Kpi
            label="FU pendentes"
            value={String(metrics.followupsPendentes)}
            tone={metrics.followupsPendentes > 0 ? "warn" : "ok"}
            hint="D30/D60/D90"
            href={buildBiologicalUrl("/material-biologico", current, {
              followup: "pending",
              page: undefined,
            })}
          />
          <Kpi
            label="FU atrasados"
            value={String(metrics.followupsAtrasados)}
            tone={metrics.followupsAtrasados > 0 ? "danger" : "ok"}
            href={buildBiologicalUrl("/material-biologico", current, {
              followup: "overdue",
              page: undefined,
            })}
          />
        </div>
      </section>
    </div>
  );
}
