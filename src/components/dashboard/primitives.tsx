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
  const accent =
    tone === "ok"
      ? "border-l-emerald-500"
      : tone === "warn"
        ? "border-l-amber-500"
        : tone === "danger"
          ? "border-l-red-500"
          : "border-l-transparent";

  const valueTone =
    tone === "ok"
      ? "text-emerald-800"
      : tone === "warn"
        ? "text-amber-800"
        : tone === "danger"
          ? "text-red-800"
          : "text-slate-900";

  const iconTone =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : tone === "warn"
        ? "bg-amber-50 text-amber-700 border-amber-100"
        : tone === "danger"
          ? "bg-red-50 text-red-700 border-red-100"
          : "bg-slate-50 text-slate-500 border-slate-100";

  const body = (
    <div
      className={cn(
        "app-surface flex h-full flex-col justify-between gap-3 border-l-[3px] p-4 transition-colors",
        accent,
        href && "hover:border-emerald-200 hover:bg-emerald-50/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.05em] text-slate-400 uppercase">
          {label}
        </p>
        {Icon ? (
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg border",
              iconTone,
            )}
          >
            <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
          </span>
        ) : null}
      </div>
      <div>
        <p
          className={cn(
            "text-[26px] leading-none font-semibold tracking-tight tabular-nums",
            valueTone,
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
  bodyClassName,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("app-surface overflow-hidden", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border-subtle px-4 py-3.5">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold tracking-tight text-slate-900">
            {title}
          </h3>
          {description ? (
            <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function DashStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "ok" | "warn" | "danger";
}) {
  const valueTone =
    tone === "ok"
      ? "text-emerald-800"
      : tone === "warn"
        ? "text-amber-800"
        : tone === "danger"
          ? "text-red-700"
          : "text-slate-900";

  return (
    <div className="rounded-lg border border-border-subtle bg-slate-50/70 px-3 py-2.5">
      <p className="text-[10px] font-semibold tracking-[0.05em] text-slate-400 uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-[20px] leading-none font-semibold tracking-tight tabular-nums",
          valueTone,
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function DashRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "ok" | "warn" | "danger";
}) {
  const valueTone =
    tone === "ok"
      ? "text-emerald-800"
      : tone === "warn"
        ? "text-amber-800"
        : tone === "danger"
          ? "text-red-700"
          : "text-slate-900";

  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-[13px] text-slate-500">{label}</dt>
      <dd
        className={cn(
          "text-[13px] font-semibold tabular-nums tracking-tight",
          valueTone,
        )}
      >
        {value}
      </dd>
    </div>
  );
}
