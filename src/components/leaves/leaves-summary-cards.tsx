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

function StripItem({
  label,
  value,
  href,
  active,
}: {
  label: string;
  value: number;
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded px-1.5 py-0.5 tabular-nums transition-colors",
        active
          ? "bg-teal-50 font-semibold text-teal-900"
          : "text-slate-600 hover:bg-white hover:text-teal-900",
      )}
    >
      <span className="text-slate-500">{label}</span>{" "}
      <span className="font-medium text-slate-800">{value}</span>
    </Link>
  );
}

export function LeavesSummaryCards({
  metrics,
  current,
}: {
  metrics: LeavesMetrics;
  current: Record<string, string | number | undefined>;
}) {
  return (
    <div className="mb-3 space-y-2">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
          <Kpi
            label="No escopo"
            value={String(metrics.total)}
            hint="Com busca/tipo atuais"
            href={buildLeavesUrl("/afastamentos", current, {
              status: undefined,
              returnPending: undefined,
              page: undefined,
            })}
          />
          <Kpi
            label="Ativos"
            value={String(metrics.ativos)}
            tone={metrics.ativos > 0 ? "warn" : "default"}
            hint="Em andamento"
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
            label="Dias ativos"
            value={String(metrics.diasAtivos)}
            hint="Soma dos ativos com fim"
          />
          <Kpi
            label="INSS + acidente"
            value={String(metrics.inss + metrics.acidentes)}
            tone={metrics.inss + metrics.acidentes > 0 ? "warn" : "default"}
            hint={`${metrics.inss} INSS · ${metrics.acidentes} acidente`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-slate-100 bg-slate-50/80 px-3 py-1.5 text-[11px]">
          <span className="mr-1 font-medium text-slate-500">Por tipo</span>
          <StripItem
            label="Atestado"
            value={metrics.atestados}
            active={current.leaveType === "ATESTADO"}
            href={buildLeavesUrl("/afastamentos", current, {
              leaveType: "ATESTADO",
              page: undefined,
            })}
          />
          <span className="text-slate-300">·</span>
          <StripItem
            label="INSS"
            value={metrics.inss}
            active={current.leaveType === "INSS"}
            href={buildLeavesUrl("/afastamentos", current, {
              leaveType: "INSS",
              page: undefined,
            })}
          />
          <span className="text-slate-300">·</span>
          <StripItem
            label="Licenças"
            value={metrics.licencas}
            active={
              current.leaveType === "LICENCA_MATERNIDADE" ||
              current.leaveType === "LICENCA_PATERNIDADE"
            }
            href={buildLeavesUrl("/afastamentos", current, {
              leaveType: "LICENCA_MATERNIDADE",
              page: undefined,
            })}
          />
          <span className="text-slate-300">·</span>
          <StripItem
            label="Acidente"
            value={metrics.acidentes}
            active={current.leaveType === "ACIDENTE"}
            href={buildLeavesUrl("/afastamentos", current, {
              leaveType: "ACIDENTE",
              page: undefined,
            })}
          />
        </div>
      </section>
    </div>
  );
}
