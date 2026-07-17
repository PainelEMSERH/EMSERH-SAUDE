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
    <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3">
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
        <label className="min-w-[200px] flex-1 text-[11px] font-medium text-slate-500">
          Busca
          <input
            name="q"
            defaultValue={current.q ?? ""}
            placeholder="Nome ou matrícula"
            className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-[13px] outline-none focus-visible:border-teal-600"
          />
        </label>
        <label className="w-full text-[11px] font-medium text-slate-500 sm:w-[200px]">
          Carteira
          <select
            name="kit"
            defaultValue={current.kit ?? "ALL"}
            className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[13px] outline-none focus-visible:border-teal-600"
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
          className="h-8 rounded-md bg-teal-800 px-3 text-[12px] font-medium text-white hover:bg-teal-900"
        >
          Filtrar
        </button>
      </form>
    </div>
  );
}
