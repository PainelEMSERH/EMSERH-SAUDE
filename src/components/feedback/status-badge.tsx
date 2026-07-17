import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Claro: fundo suave + borda.
 * Escuro: outline (como carteira vacinal) — sem bloco claro estourando no preto.
 */
const TONES: Record<string, string> = {
  ok: cn(
    "border-[color:var(--primary-border)] bg-[color:var(--primary-soft)] text-[color:var(--success)]",
    "dark:border-[color:var(--primary)] dark:bg-transparent dark:text-[color:var(--primary)]",
  ),
  warn: cn(
    "border-amber-200/80 bg-amber-50 text-[color:var(--warning)]",
    "dark:border-[color:var(--warning)] dark:bg-transparent dark:text-[color:var(--warning)]",
  ),
  danger: cn(
    "border-red-200/80 bg-red-50 text-[color:var(--danger)]",
    "dark:border-[color:var(--danger)] dark:bg-transparent dark:text-[color:var(--danger)]",
  ),
  muted: cn(
    "border-border bg-muted text-muted-foreground",
    "dark:border-border dark:bg-transparent dark:text-muted-foreground",
  ),
  info: cn(
    "border-blue-200/80 bg-blue-50 text-[color:var(--info)]",
    "dark:border-[color:var(--info)] dark:bg-transparent dark:text-[color:var(--info)]",
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
