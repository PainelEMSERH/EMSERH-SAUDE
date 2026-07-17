"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { LeavesTabCounts } from "@/db/queries/occupational";
import {
  LEAVE_STATUSES,
  LEAVE_TABS,
  LEAVE_TYPES,
  buildLeavesUrl,
  type LeaveTabValue,
} from "@/lib/leaves/constants";
import { cn } from "@/lib/utils";

export function LeavesFilters({
  current,
  group,
  tabCounts,
}: {
  current: {
    q?: string;
    status?: string;
    group?: string;
    leaveType?: string;
    returnPending?: string;
  };
  group: LeaveTabValue;
  tabCounts: LeavesTabCounts;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply(form: HTMLFormElement) {
    const fd = new FormData(form);
    const params = new URLSearchParams();
    params.set("group", group);
    for (const key of ["q", "status", "leaveType", "returnPending"] as const) {
      const v = String(fd.get(key) ?? "").trim();
      if (v && v !== "ALL") params.set(key, v);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/afastamentos?${qs}` : "/afastamentos");
    });
  }

  const countFor = (tab: LeaveTabValue) => {
    if (tab === "ALL") return tabCounts.ALL;
    return tabCounts[tab];
  };

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap gap-0 border-b border-border">
        {LEAVE_TABS.map((tab) => {
          const active = group === tab.value;
          const n = countFor(tab.value);
          return (
            <Link
              key={tab.value}
              href={buildLeavesUrl("/afastamentos", current, {
                group: tab.value,
                leaveType: undefined,
                page: undefined,
              })}
              title={tab.hint}
              className={cn(
                "inline-flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors",
                active
                  ? "border-primary bg-primary-soft/80 text-primary"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  active
                    ? "bg-primary-soft text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {n}
              </span>
            </Link>
          );
        })}
      </div>

      <form
        className={cn(
          "flex flex-col gap-2.5 p-3 lg:flex-row lg:flex-wrap lg:items-end",
          pending ? "opacity-70" : "",
        )}
        onSubmit={(e) => {
          e.preventDefault();
          apply(e.currentTarget);
        }}
        onChange={(e) => {
          const form = e.currentTarget;
          if (!(e.target instanceof HTMLSelectElement)) return;
          apply(form);
        }}
      >
        <label className="min-w-[180px] flex-1 text-[11px] font-medium text-muted-foreground">
          Busca
          <input
            name="q"
            defaultValue={current.q ?? ""}
            placeholder="Nome ou matrícula"
            className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2.5 text-[13px] text-foreground outline-none focus-visible:border-primary"
          />
        </label>
        <label className="w-full text-[11px] font-medium text-muted-foreground sm:w-[140px]">
          Status
          <select
            name="status"
            defaultValue={current.status ?? "ALL"}
            className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[13px] outline-none focus-visible:border-primary"
          >
            <option value="ALL">Todos</option>
            {LEAVE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {group === "licencas" || group === "ALL" ? (
          <label className="w-full text-[11px] font-medium text-muted-foreground sm:w-[220px]">
            Tipo (refinar)
            <select
              name="leaveType"
              defaultValue={current.leaveType ?? "ALL"}
              className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[13px] outline-none focus-visible:border-primary"
            >
              <option value="ALL">Todos da aba</option>
              {(group === "licencas"
                ? LEAVE_TYPES.filter((t) => t.code === "03" || t.code === "11")
                : LEAVE_TYPES
              ).map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="leaveType" value="" />
        )}
        <label className="flex h-8 items-center gap-2 rounded-md border border-border bg-muted px-2.5 text-[12px] text-foreground/80">
          <input
            type="checkbox"
            name="returnPending"
            value="1"
            defaultChecked={current.returnPending === "1"}
            className="size-3.5 accent-primary"
            onChange={(e) => {
              const form = e.currentTarget.form;
              if (form) apply(form);
            }}
          />
          Só retorno ASO pendente
        </label>
        <button
          type="submit"
          className="h-8 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Filtrar
        </button>
      </form>
    </div>
  );
}
