"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PREGNANCY_STATUSES } from "@/lib/pregnancy/constants";
import { cn } from "@/lib/utils";

export function PregnancyFilters({
  current,
}: {
  current: {
    q?: string;
    status?: string;
    hazardous?: string;
    alert?: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply(form: HTMLFormElement) {
    const fd = new FormData(form);
    const params = new URLSearchParams();
    for (const key of ["q", "status", "hazardous", "alert"] as const) {
      const v = String(fd.get(key) ?? "").trim();
      if (v && v !== "ALL") params.set(key, v);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/gestantes?${qs}` : "/gestantes");
    });
  }

  return (
    <div className="app-surface mb-3 p-3.5">
      <form
        className={cn(
          "flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-end",
          pending ? "opacity-70" : "",
        )}
        onSubmit={(e) => {
          e.preventDefault();
          apply(e.currentTarget);
        }}
        onChange={(e) => {
          if (!(e.target instanceof HTMLSelectElement)) return;
          apply(e.currentTarget);
        }}
      >
        <label className="min-w-[200px] flex-1 text-[11px] font-medium text-muted-foreground">
          Busca
          <input
            name="q"
            defaultValue={current.q ?? ""}
            placeholder="Nome, matrícula ou setor"
            className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2.5 text-[13px] outline-none focus-visible:border-primary"
          />
        </label>
        <label className="w-full text-[11px] font-medium text-muted-foreground sm:w-[170px]">
          Status
          <select
            name="status"
            defaultValue={current.status ?? "ALL"}
            className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[13px] outline-none focus-visible:border-primary"
          >
            {PREGNANCY_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="w-full text-[11px] font-medium text-muted-foreground sm:w-[150px]">
          Insalubridade
          <select
            name="hazardous"
            defaultValue={current.hazardous ?? "ALL"}
            className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[13px] outline-none focus-visible:border-primary"
          >
            <option value="ALL">Todas</option>
            <option value="1">Só insalubre</option>
            <option value="0">Sem insalubre</option>
          </select>
        </label>
        <label className="flex h-8 items-center gap-2 rounded-md border border-border bg-muted px-2.5 text-[12px] text-foreground/80">
          <input
            type="checkbox"
            name="alert"
            value="1"
            defaultChecked={current.alert === "1"}
            className="size-3.5 accent-primary"
            onChange={(e) => {
              const form = e.currentTarget.form;
              if (form) apply(form);
            }}
          />
          Só sem realocação
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
