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

export function AsoPrioritiesPanel({
  priorities,
  current,
  activePriority,
}: {
  priorities: AsoPriorities;
  current: Record<string, string | number | undefined>;
  activePriority?: string;
}) {
  const items: Array<{
    key: string;
    label: string;
    value: number;
    tone: "danger" | "warn" | "info" | "muted";
  }> = [
    { key: "vencidos", label: "Vencidos", value: priorities.vencidos, tone: "danger" },
    { key: "vencendo7", label: "Vencendo em 7 dias", value: priorities.vencendo7, tone: "warn" },
    { key: "vencendo30", label: "Vencendo em 30 dias", value: priorities.vencendo30, tone: "warn" },
    {
      key: "pendentesAlterdata",
      label: "Pendentes Alterdata",
      value: priorities.pendentesAlterdata,
      tone: "info",
    },
    { key: "divergencias", label: "Divergências de data", value: priorities.divergencias, tone: "danger" },
    {
      key: "atualizadoSemRegistro",
      label: "Atualizado sem registro",
      value: priorities.atualizadoSemRegistro,
      tone: "info",
    },
    { key: "semProximoAso", label: "Sem próximo ASO", value: priorities.semProximoAso, tone: "muted" },
    { key: "afastadosRetorno", label: "Afastados", value: priorities.afastadosRetorno, tone: "muted" },
  ];

  const toneClasses: Record<string, string> = {
    danger: "border-red-200 bg-red-50 text-red-800 hover:bg-red-100",
    warn: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
    info: "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100",
    muted: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
  };

  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {items
        .filter((i) => i.value > 0)
        .map((item) => (
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
      {priorities.competenciasAguardando > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1 text-[12px] font-medium text-amber-900">
          Competência em conferência
        </span>
      ) : null}
    </div>
  );
}
