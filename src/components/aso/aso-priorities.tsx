import Link from "next/link";
import { buildAsoUrl } from "@/lib/aso/planning";
import { cn } from "@/lib/utils";

export type AsoPriorities = {
  vencidos: number;
  vencendo7: number;
  vencendo30: number;
  pendentesAlterdata: number;
  divergencias: number;
  atualizadoSemRegistro: number;
  semProximoAso: number;
  afastadosRetorno: number;
  competenciasAguardando: number;
};

function ChipRow({
  title,
  items,
  current,
  activePriority,
}: {
  title: string;
  items: Array<{
    key: string;
    label: string;
    value: number;
    tone: "danger" | "warn" | "info" | "muted";
  }>;
  current: Record<string, string | number | undefined>;
  activePriority?: string;
}) {
  const toneClasses: Record<string, string> = {
    danger: "border-red-200 bg-red-50 text-red-800 hover:bg-red-100",
    warn: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
    info: "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100",
    muted: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
  };

  const visible = items.filter((i) => i.value > 0);
  if (!visible.length) {
    return (
      <div>
        <p className="mb-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
          {title}
        </p>
        <p className="text-[12px] text-slate-400">Nenhuma prioridade neste escopo.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((item) => (
          <Link
            key={item.key}
            href={buildAsoUrl("/asos", current, {
              priority: activePriority === item.key ? undefined : item.key,
              page: undefined,
            })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors",
              toneClasses[item.tone],
              activePriority === item.key ? "ring-2 ring-teal-400" : "",
            )}
          >
            {item.label}
            <span className="rounded-full bg-white/70 px-1.5 py-0 text-[11px] font-semibold">
              {item.value}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AsoPrioritiesPanel({
  priorities,
  yearPriorities,
  current,
  activePriority,
}: {
  priorities: AsoPriorities;
  yearPriorities: AsoPriorities;
  current: Record<string, string | number | undefined>;
  activePriority?: string;
}) {
  const competenceItems = [
    { key: "vencidos", label: "Vencidos na competência", value: priorities.vencidos, tone: "danger" as const },
    { key: "vencendo7", label: "Vencendo em 7 dias", value: priorities.vencendo7, tone: "warn" as const },
    { key: "vencendo30", label: "Vencendo em 30 dias", value: priorities.vencendo30, tone: "warn" as const },
    {
      key: "pendentesAlterdata",
      label: "Pendentes no Alterdata",
      value: priorities.pendentesAlterdata,
      tone: "info" as const,
    },
    { key: "divergencias", label: "Divergências", value: priorities.divergencias, tone: "danger" as const },
  ];

  const yearItems = [
    {
      key: "year_vencidos",
      label: "Vencidos no ano",
      value: yearPriorities.vencidos,
      tone: "danger" as const,
      patch: { priority: "vencidos", mode: "accumulated", month: 12 },
    },
    {
      key: "year_pendentes",
      label: "Pendentes Alterdata (ano)",
      value: yearPriorities.pendentesAlterdata,
      tone: "info" as const,
      patch: {
        priority: "pendentesAlterdata",
        mode: "accumulated",
        month: 12,
      },
    },
  ];

  return (
    <div className="mb-3 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <ChipRow
        title="Prioridades da competência"
        items={competenceItems}
        current={current}
        activePriority={activePriority}
      />
      <div className="border-t border-slate-100 pt-3">
        <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
          Visão anual
        </p>
        <div className="flex flex-wrap gap-1.5">
          {yearItems
            .filter((i) => i.value > 0)
            .map((item) => (
              <Link
                key={item.key}
                href={buildAsoUrl("/asos", current, {
                  ...item.patch,
                  page: undefined,
                })}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors",
                  item.tone === "danger"
                    ? "border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
                    : "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100",
                )}
              >
                {item.label}
                <span className="rounded-full bg-white/70 px-1.5 py-0 text-[11px] font-semibold">
                  {item.value}
                </span>
              </Link>
            ))}
          {!yearItems.some((i) => i.value > 0) ? (
            <p className="text-[12px] text-slate-400">Nenhuma prioridade anual neste escopo.</p>
          ) : null}
        </div>
        {yearPriorities.competenciasAguardando > 0 || priorities.competenciasAguardando > 0 ? (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1 text-[12px] font-medium text-amber-900">
            Competência em conferência
          </span>
        ) : null}
      </div>
    </div>
  );
}
