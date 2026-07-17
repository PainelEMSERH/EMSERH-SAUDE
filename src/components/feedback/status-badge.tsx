import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Tons semânticos via tokens — suaves, com significado preservado. */
const TONES: Record<string, string> = {
  ok: "border-[color:var(--primary-border)] bg-[color:var(--primary-soft)] text-[color:var(--success)]",
  warn: "border-amber-200/80 bg-amber-50 text-[color:var(--warning)] dark:border-amber-500/30 dark:bg-amber-500/10",
  danger:
    "border-red-200/80 bg-red-50 text-[color:var(--danger)] dark:border-red-500/30 dark:bg-red-500/10",
  muted:
    "border-border bg-muted text-muted-foreground",
  info: "border-blue-200/80 bg-blue-50 text-[color:var(--info)] dark:border-blue-500/30 dark:bg-blue-500/10",
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
