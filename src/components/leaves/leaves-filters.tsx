"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LEAVE_STATUSES, LEAVE_TYPES } from "@/lib/leaves/constants";
import { cn } from "@/lib/utils";

export function LeavesFilters({
  current,
}: {
  current: {
    q?: string;
    status?: string;
    leaveType?: string;
    returnPending?: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply(form: HTMLFormElement) {
    const fd = new FormData(form);
    const params = new URLSearchParams();
    for (const key of ["q", "status", "leaveType", "returnPending"] as const) {
      const v = String(fd.get(key) ?? "").trim();
      if (v && v !== "ALL") params.set(key, v);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/afastamentos?${qs}` : "/afastamentos");
    });
  }

  return (
    <div className="mb-3 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
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
          const form = e.currentTarget;
          if (!(e.target instanceof HTMLSelectElement)) return;
          apply(form);
        }}
      >
        <label className="min-w-[180px] flex-1 text-[11px] font-medium text-slate-500">
          Busca
          <input
            name="q"
            defaultValue={current.q ?? ""}
            placeholder="Nome ou matrícula"
            className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-[13px] text-slate-800 outline-none focus-visible:border-teal-600"
          />
        </label>
        <label className="w-full text-[11px] font-medium text-slate-500 sm:w-[150px]">
          Status
          <select
            name="status"
            defaultValue={current.status ?? "ALL"}
            className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[13px] outline-none focus-visible:border-teal-600"
          >
            <option value="ALL">Todos</option>
            {LEAVE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="w-full text-[11px] font-medium text-slate-500 sm:w-[190px]">
          Tipo
          <select
            name="leaveType"
            defaultValue={current.leaveType ?? "ALL"}
            className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[13px] outline-none focus-visible:border-teal-600"
          >
            <option value="ALL">Todos</option>
            {LEAVE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-[12px] text-slate-700">
          <input
            type="checkbox"
            name="returnPending"
            value="1"
            defaultChecked={current.returnPending === "1"}
            className="size-3.5 accent-teal-800"
            onChange={(e) => {
              const form = e.currentTarget.form;
              if (form) apply(form);
            }}
          />
          Só retorno ASO pendente
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
