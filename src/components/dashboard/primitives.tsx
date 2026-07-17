import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashKpi({
  label,
  value,
  hint,
  href,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  icon?: LucideIcon;
  tone?: "default" | "ok" | "warn" | "danger";
}) {
  const toneValue =
    tone === "ok"
      ? "text-emerald-800"
      : tone === "warn"
        ? "text-amber-800"
        : tone === "danger"
          ? "text-red-800"
          : "text-slate-900";

  const body = (
    <div
      className={cn(
        "app-surface flex h-full flex-col justify-between gap-3 p-4 transition-colors",
        href && "hover:border-emerald-200 hover:bg-emerald-50/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.06em] text-slate-400 uppercase">
          {label}
        </p>
        {Icon ? (
          <Icon className="size-4 text-slate-400" strokeWidth={1.75} aria-hidden />
        ) : null}
      </div>
      <div>
        <p
          className={cn(
            "text-[28px] font-semibold tracking-tight tabular-nums leading-none",
            toneValue,
          )}
        >
          {value}
        </p>
        {hint ? (
          <p className="mt-2 text-[12px] leading-snug text-slate-500">{hint}</p>
        ) : null}
      </div>
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

export function DashPanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("app-surface overflow-hidden", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border-subtle px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold tracking-tight text-slate-900">
            {title}
          </h3>
          {description ? (
            <p className="mt-0.5 text-[12px] text-slate-500">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
