import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  ok: "border-teal-200 bg-teal-50 text-teal-800",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800",
  muted: "border-slate-200 bg-slate-50 text-slate-700",
  info: "border-sky-200 bg-sky-50 text-sky-800",
};

export function StatusBadge({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-auto px-2 py-1 text-[10px] font-medium leading-none whitespace-nowrap",
        TONES[tone] ?? TONES.muted,
      )}
    >
      {label}
    </Badge>
  );
}

export function deadlineTone(status: string | null | undefined) {
  switch (status) {
    case "VENCIDO":
      return "danger" as const;
    case "A_VENCER":
      return "warn" as const;
    case "EM_DIA":
      return "ok" as const;
    default:
      return "muted" as const;
  }
}
