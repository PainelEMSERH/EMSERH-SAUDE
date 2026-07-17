import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Badges institucionais: suave no claro, outline discreto no escuro. */
const TONES: Record<string, string> = {
  ok: cn(
    "border-[color:var(--primary-border)] bg-[color:var(--primary-soft)] text-[color:var(--success)]",
    "dark:border-[color:var(--primary-border)] dark:bg-[color:var(--primary-soft)] dark:text-[color:var(--accent-foreground)]",
  ),
  warn: cn(
    "border-amber-200/70 bg-amber-50 text-[color:var(--warning)]",
    "dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200/90",
  ),
  danger: cn(
    "border-red-200/70 bg-red-50 text-[color:var(--danger)]",
    "dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200/90",
  ),
  muted: cn(
    "border-border bg-muted text-muted-foreground",
    "dark:border-border dark:bg-muted/50 dark:text-muted-foreground",
  ),
  info: cn(
    "border-blue-200/70 bg-blue-50 text-[color:var(--info)]",
    "dark:border-blue-800/50 dark:bg-blue-950/40 dark:text-blue-200/90",
  ),
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
