import Link from "next/link";
import type { PregnancyMetrics } from "@/db/queries/occupational";
import { buildPregnancyUrl } from "@/lib/pregnancy/constants";
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
    default: "text-foreground",
    danger: "text-red-700",
    warn: "text-amber-700",
    ok: "text-primary",
  } as const;

  const body = (
    <div
      className={cn(
        "flex h-full min-w-0 flex-col justify-center px-2.5 py-2.5 sm:px-3",
        href ? "transition-colors hover:bg-primary-soft" : "",
      )}
    >
      <p className="text-[10px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
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
          className="mt-1 truncate text-[10px] leading-tight text-muted-foreground"
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

export function PregnancySummaryCards({
  metrics,
  current,
}: {
  metrics: PregnancyMetrics;
  current: Record<string, string | number | undefined>;
}) {
  return (
    <div className="mb-3">
      <section className="app-surface overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-border-subtle sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
          <Kpi
            label="Casos"
            value={String(metrics.total)}
            hint="No escopo / busca"
            href={buildPregnancyUrl("/gestantes", current, {
              status: undefined,
              hazardous: undefined,
              alert: undefined,
              page: undefined,
            })}
          />
          <Kpi
            label="Em acomp."
            value={String(metrics.emAcompanhamento)}
            tone={metrics.emAcompanhamento > 0 ? "warn" : "ok"}
            href={buildPregnancyUrl("/gestantes", current, {
              status: "EM_ACOMPANHAMENTO",
              alert: undefined,
              page: undefined,
            })}
          />
          <Kpi
            label="Licença"
            value={String(metrics.licenca)}
            tone="default"
            href={buildPregnancyUrl("/gestantes", current, {
              status: "LICENCA",
              alert: undefined,
              page: undefined,
            })}
          />
          <Kpi
            label="Encerrados"
            value={String(metrics.encerrados)}
            tone="ok"
            href={buildPregnancyUrl("/gestantes", current, {
              status: "APTO",
              alert: undefined,
              page: undefined,
            })}
          />
          <Kpi
            label="Insalubre"
            value={String(metrics.insalubre)}
            href={buildPregnancyUrl("/gestantes", current, {
              hazardous: "1",
              alert: undefined,
              page: undefined,
            })}
          />
          <Kpi
            label="Sem realocação"
            value={String(metrics.semRealocacao)}
            tone={metrics.semRealocacao > 0 ? "danger" : "ok"}
            hint="Insalubre em acomp."
            href={buildPregnancyUrl("/gestantes", current, {
              alert: "1",
              status: undefined,
              hazardous: undefined,
              page: undefined,
            })}
          />
        </div>
      </section>
    </div>
  );
}
