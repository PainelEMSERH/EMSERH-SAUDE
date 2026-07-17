"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

export function VaccinationFilters({
  current,
}: {
  current: { q?: string; kit?: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply(form: HTMLFormElement) {
    const fd = new FormData(form);
    const params = new URLSearchParams();
    for (const key of ["q", "kit"] as const) {
      const v = String(fd.get(key) ?? "").trim();
      if (v && v !== "ALL") params.set(key, v);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/vacinacao?${qs}` : "/vacinacao");
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
            placeholder="Nome ou matrícula"
            className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2.5 text-[13px] outline-none focus-visible:border-primary"
          />
        </label>
        <label className="w-full text-[11px] font-medium text-muted-foreground sm:w-[200px]">
          Carteira
          <select
            name="kit"
            defaultValue={current.kit ?? "ALL"}
            className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2 text-[13px] outline-none focus-visible:border-primary"
          >
            <option value="ALL">Todas</option>
            <option value="incomplete">Incompletas / pendências</option>
            <option value="complete">Kit completo</option>
            <option value="attention">Parcial ou atenção</option>
            <option value="refusal">Com termo de recusa</option>
          </select>
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
