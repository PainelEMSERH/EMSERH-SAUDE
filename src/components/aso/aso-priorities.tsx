import Link from "next/link";
import { MONTH_LABELS, MONTH_NAMES } from "@/lib/aso/constants";
import { buildAsoUrl } from "@/lib/aso/planning";
import { cn } from "@/lib/utils";

export type AsoOperationalPriorities = {
  aFazerMes: number;
  realizadosMes: number;
  pendentesAlterdata: number;
  divergencias: number;
  pendentesAnteriores: number;
  proximoMes: number;
  proximoMesNumber: number | null;
  competenciasAguardando: number;
  byMonth: Array<{
    month: number;
    aFazer: number;
    realizados: number;
    previstos: number;
  }>;
};

function Chip({
  href,
  label,
  value,
  tone,
  active,
}: {
  href: string;
  label: string;
  value: number;
  tone: "danger" | "warn" | "ok" | "info" | "muted";
  active?: boolean;
}) {
  const toneClasses: Record<string, string> = {
    danger: "border-red-200 bg-red-50 text-red-800 hover:bg-red-100",
    warn: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
    ok: "border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100",
    info: "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100",
    muted: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
  };
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors",
        toneClasses[tone],
        active ? "ring-2 ring-teal-400" : "",
      )}
    >
      {label}
      <span className="rounded-full bg-white/70 px-1.5 py-0 text-[11px] font-semibold tabular-nums">
        {value}
      </span>
    </Link>
  );
}

export function AsoPrioritiesPanel({
  priorities,
  current,
  activePriority,
  activeMonth,
}: {
  priorities: AsoOperationalPriorities;
  current: Record<string, string | number | undefined>;
  activePriority?: string;
  activeMonth: number;
}) {
  const monthName = MONTH_NAMES[activeMonth - 1] ?? `Mês ${activeMonth}`;
  const nextLabel =
    priorities.proximoMesNumber != null
      ? MONTH_NAMES[priorities.proximoMesNumber - 1]
      : null;

  return (
    <div className="mb-3 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div>
        <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
          Controle de {monthName}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Chip
            href={buildAsoUrl("/asos", current, {
              priority: activePriority === "aFazerMes" ? undefined : "aFazerMes",
              page: undefined,
            })}
            label="A fazer neste mês"
            value={priorities.aFazerMes}
            tone="warn"
            active={activePriority === "aFazerMes"}
          />
          <Chip
            href={buildAsoUrl("/asos", current, {
              priority:
                activePriority === "realizadosMes" ? undefined : "realizadosMes",
              page: undefined,
            })}
            label="Já realizados"
            value={priorities.realizadosMes}
            tone="ok"
            active={activePriority === "realizadosMes"}
          />
          <Chip
            href={buildAsoUrl("/asos", current, {
              priority:
                activePriority === "pendentesAlterdata"
                  ? undefined
                  : "pendentesAlterdata",
              page: undefined,
            })}
            label="Pendentes no Alterdata"
            value={priorities.pendentesAlterdata}
            tone="info"
            active={activePriority === "pendentesAlterdata"}
          />
          {priorities.divergencias > 0 ? (
            <Chip
              href={buildAsoUrl("/asos", current, {
                priority:
                  activePriority === "divergencias" ? undefined : "divergencias",
                page: undefined,
              })}
              label="Divergências"
              value={priorities.divergencias}
              tone="danger"
              active={activePriority === "divergencias"}
            />
          ) : null}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
          Pendências e antecipação
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Chip
            href={buildAsoUrl("/asos", current, {
              priority:
                activePriority === "pendentesAnteriores"
                  ? undefined
                  : "pendentesAnteriores",
              page: undefined,
            })}
            label="Pendentes de meses anteriores"
            value={priorities.pendentesAnteriores}
            tone={priorities.pendentesAnteriores > 0 ? "danger" : "muted"}
            active={activePriority === "pendentesAnteriores"}
          />
          {nextLabel && priorities.proximoMesNumber ? (
            <Chip
              href={buildAsoUrl("/asos", current, {
                month: priorities.proximoMesNumber,
                priority: undefined,
                page: undefined,
              })}
              label={`Antecipar ${nextLabel}`}
              value={priorities.proximoMes}
              tone="muted"
            />
          ) : null}
          {priorities.competenciasAguardando > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1 text-[12px] font-medium text-amber-900">
              Competência em conferência
            </span>
          ) : null}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
          Quantidade a fazer por mês
        </p>
        <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
          {priorities.byMonth.map((m) => {
            const isActive = m.month === activeMonth;
            return (
              <Link
                key={m.month}
                href={buildAsoUrl("/asos", current, {
                  month: m.month,
                  priority: undefined,
                  page: undefined,
                })}
                title={`${MONTH_NAMES[m.month - 1]}: ${m.aFazer} a fazer · ${m.realizados} realizados`}
                className={cn(
                  "rounded-md border px-1 py-1.5 text-center transition-colors",
                  isActive
                    ? "border-teal-300 bg-teal-50 ring-1 ring-teal-200"
                    : m.aFazer > 0
                      ? "border-slate-200 bg-white hover:border-teal-200 hover:bg-teal-50/40"
                      : "border-slate-100 bg-slate-50/80 hover:bg-slate-100",
                )}
              >
                <p className="text-[10px] font-medium text-slate-500">
                  {MONTH_LABELS[m.month - 1]}
                </p>
                <p
                  className={cn(
                    "text-[13px] font-semibold tabular-nums",
                    m.aFazer > 0 ? "text-slate-900" : "text-slate-400",
                  )}
                >
                  {m.aFazer}
                </p>
              </Link>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">
          Clique no mês para abrir a competência. Número = ainda a fazer.
        </p>
      </div>
    </div>
  );
}
