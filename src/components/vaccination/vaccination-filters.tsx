"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { VaccinationTabCounts } from "@/db/queries/occupational";
import {
  VACCINE_DEFS,
  VACCINE_SITUATIONS,
  buildVaccinationUrl,
  type VaccineCode,
} from "@/lib/vaccination/constants";
import { cn } from "@/lib/utils";

export function VaccinationFilters({
  current,
  vaccine,
  tabCounts,
}: {
  current: {
    q?: string;
    vaccine?: string;
    situation?: string;
    kind?: string;
  };
  vaccine: VaccineCode;
  tabCounts: VaccinationTabCounts;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const situations = VACCINE_SITUATIONS[vaccine] ?? [];

  function apply(form: HTMLFormElement) {
    const fd = new FormData(form);
    const params = new URLSearchParams();
    params.set("vaccine", vaccine);
    for (const key of ["q", "situation", "kind"] as const) {
      const v = String(fd.get(key) ?? "").trim();
      if (v && v !== "ALL") params.set(key, v);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/vacinacao?${qs}` : "/vacinacao");
    });
  }

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap gap-0 border-b border-slate-200">
        {VACCINE_DEFS.map((tab) => {
          const active = vaccine === tab.code;
          const n = tabCounts[tab.code] ?? 0;
          return (
            <Link
              key={tab.code}
              href={buildVaccinationUrl("/vacinacao", current, {
                vaccine: tab.code,
                situation: undefined,
                page: undefined,
              })}
              className={cn(
                "inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
                active
                  ? "border-teal-700 bg-teal-50/80 text-teal-900"
                  : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              {tab.shortLabel}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  active
                    ? "bg-teal-100 text-teal-800"
                    : "bg-slate-100 text-slate-500",
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
          if (!(e.target instanceof HTMLSelectElement)) return;
          apply(e.currentTarget);
        }}
      >
        <label className="min-w-[180px] flex-1 text-[11px] font-medium text-slate-500">
          Busca
          <input
            name="q"
            defaultValue={current.q ?? ""}
            placeholder="Nome ou matrícula"
            className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-[13px] outline-none focus-visible:border-teal-600"
          />
        </label>
        <label className="w-full text-[11px] font-medium text-slate-500 sm:w-[260px]">
          Situação
          <select
            name="situation"
            defaultValue={current.situation ?? "ALL"}
            className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[13px] outline-none focus-visible:border-teal-600"
          >
            <option value="ALL">Todas</option>
            {situations.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="w-full text-[11px] font-medium text-slate-500 sm:w-[160px]">
          Classificação
          <select
            name="kind"
            defaultValue={current.kind ?? "ALL"}
            className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[13px] outline-none focus-visible:border-teal-600"
          >
            <option value="ALL">Todas</option>
            <option value="ok">Em dia</option>
            <option value="partial">Parcial</option>
            <option value="attention">Atenção</option>
            <option value="refusal">Recusa</option>
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
