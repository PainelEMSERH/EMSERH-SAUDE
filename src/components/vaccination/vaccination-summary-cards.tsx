import Link from "next/link";
import type { VaccinationMetrics } from "@/db/queries/occupational";
import { buildVaccinationUrl } from "@/lib/vaccination/constants";
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

export function VaccinationSummaryCards({
  metrics,
  current,
  vaccineLabel,
}: {
  metrics: VaccinationMetrics;
  current: Record<string, string | number | undefined>;
  vaccineLabel: string;
}) {
  return (
    <div className="mb-3">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-1.5 text-[11px] text-slate-500">
          Indicadores ·{" "}
          <span className="font-semibold text-slate-700">{vaccineLabel}</span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
          <Kpi label="Na aba" value={String(metrics.total)} hint="Com filtros atuais" />
          <Kpi
            label="Em dia"
            value={String(metrics.ok)}
            tone="ok"
            href={buildVaccinationUrl("/vacinacao", current, {
              kind: "ok",
              page: undefined,
            })}
          />
          <Kpi
            label="Parcial"
            value={String(metrics.partial)}
            tone="default"
            href={buildVaccinationUrl("/vacinacao", current, {
              kind: "partial",
              page: undefined,
            })}
          />
          <Kpi
            label="Atenção"
            value={String(metrics.attention)}
            tone={metrics.attention > 0 ? "warn" : "default"}
            href={buildVaccinationUrl("/vacinacao", current, {
              kind: "attention",
              page: undefined,
            })}
          />
          <Kpi
            label="Recusa"
            value={String(metrics.refusal)}
            tone={metrics.refusal > 0 ? "danger" : "ok"}
            href={buildVaccinationUrl("/vacinacao", current, {
              kind: "refusal",
              page: undefined,
            })}
          />
        </div>
      </section>
    </div>
  );
}
