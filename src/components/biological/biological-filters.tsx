"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { BIO_STATUSES } from "@/lib/biological/constants";
import { cn } from "@/lib/utils";

export function BiologicalFilters({
  current,
}: {
  current: {
    q?: string;
    status?: string;
    pep?: string;
    followup?: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply(form: HTMLFormElement) {
    const fd = new FormData(form);
    const params = new URLSearchParams();
    for (const key of ["q", "status", "pep", "followup"] as const) {
      const v = String(fd.get(key) ?? "").trim();
      if (v && v !== "ALL") params.set(key, v);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/material-biologico?${qs}` : "/material-biologico");
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
            placeholder="Nome, matrícula, local ou CAT"
            className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-[13px] outline-none focus-visible:border-teal-600"
          />
        </label>
        <label className="w-full text-[11px] font-medium text-slate-500 sm:w-[170px]">
          Status
          <select
            name="status"
            defaultValue={current.status ?? "ALL"}
            className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[13px] outline-none focus-visible:border-teal-600"
          >
            {BIO_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="w-full text-[11px] font-medium text-slate-500 sm:w-[130px]">
          PEP
          <select
            name="pep"
            defaultValue={current.pep ?? "ALL"}
            className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[13px] outline-none focus-visible:border-teal-600"
          >
            <option value="ALL">Todos</option>
            <option value="1">Com PEP</option>
            <option value="0">Sem PEP</option>
          </select>
        </label>
        <label className="w-full text-[11px] font-medium text-slate-500 sm:w-[170px]">
          Follow-up
          <select
            name="followup"
            defaultValue={current.followup ?? "ALL"}
            className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[13px] outline-none focus-visible:border-teal-600"
          >
            <option value="ALL">Todos</option>
            <option value="overdue">Com atraso</option>
            <option value="pending">Pendentes</option>
            <option value="done">D30–D90 ok</option>
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
