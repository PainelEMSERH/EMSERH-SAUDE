import Link from "next/link";
import type { LeavesMetrics } from "@/db/queries/occupational";
import { buildLeavesUrl } from "@/lib/leaves/constants";
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

export function LeavesSummaryCards({
  metrics,
  current,
  groupLabel,
}: {
  metrics: LeavesMetrics;
  current: Record<string, string | number | undefined>;
  groupLabel: string;
}) {
  return (
    <div className="mb-3">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-1.5 text-[11px] text-slate-500">
          Indicadores da aba{" "}
          <span className="font-semibold text-slate-700">{groupLabel}</span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
          <Kpi
            label="Na aba"
            value={String(metrics.total)}
            hint="Com busca/status atuais"
          />
          <Kpi
            label="Ativos"
            value={String(metrics.ativos)}
            tone={metrics.ativos > 0 ? "warn" : "default"}
            href={buildLeavesUrl("/afastamentos", current, {
              status: "ATIVO",
              returnPending: undefined,
              page: undefined,
            })}
          />
          <Kpi
            label="Encerrados"
            value={String(metrics.encerrados)}
            tone="ok"
            href={buildLeavesUrl("/afastamentos", current, {
              status: "ENCERRADO",
              returnPending: undefined,
              page: undefined,
            })}
          />
          <Kpi
            label="Retorno ASO"
            value={String(metrics.retornoPendente)}
            tone={metrics.retornoPendente > 0 ? "danger" : "ok"}
            hint="Pendentes de retorno"
            href={buildLeavesUrl("/afastamentos", current, {
              returnPending: "1",
              status: undefined,
              page: undefined,
            })}
          />
          <Kpi
            label="Dias (ativos)"
            value={String(metrics.diasAtivos)}
            hint="Soma estimada na aba"
          />
        </div>
      </section>
    </div>
  );
}
