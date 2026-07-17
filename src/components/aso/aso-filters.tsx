"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { ASO_TYPE_TABS, MONTH_NAMES } from "@/lib/aso/constants";
import { buildAsoUrl } from "@/lib/aso/planning";
import { formatUnitDisplayName } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Opt = { id: string; name: string; code?: string | null };
type UnitOpt = { id: string; name: string; regionId: string | null };

export type AsoFiltersParams = {
  year: number;
  month: number;
  regionId?: string;
  unitId?: string;
  asoType: string;
  mode: "monthly" | "accumulated";
  q?: string;
};

function submitForm(el: HTMLElement) {
  el.closest("form")?.requestSubmit();
}

export function AsoFilters({
  years,
  regions,
  units,
  params,
  hideRegion,
  lockRegion,
  hideUnit,
  lockUnit,
}: {
  years: number[];
  regions: Opt[];
  units: UnitOpt[];
  params: AsoFiltersParams;
  hideRegion?: boolean;
  lockRegion?: boolean;
  hideUnit?: boolean;
  lockUnit?: boolean;
}) {
  const [selectedRegion, setSelectedRegion] = useState(params.regionId || "ALL");
  const [selectedUnit, setSelectedUnit] = useState(params.unitId || "ALL");

  useEffect(() => {
    setSelectedRegion(params.regionId || "ALL");
    setSelectedUnit(params.unitId || "ALL");
  }, [params.regionId, params.unitId]);

  const filteredUnits = useMemo(() => {
    if (!selectedRegion || selectedRegion === "ALL") return units;
    return units.filter((u) => u.regionId === selectedRegion);
  }, [units, selectedRegion]);

  const current: Record<string, string | number | undefined> = {
    year: params.year,
    month: params.month,
    regionId: params.regionId,
    unitId: params.unitId,
    type: params.asoType,
    mode: params.mode,
    q: params.q,
  };

  return (
    <div className="mb-3 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <form
        action="/asos"
        method="get"
        className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end"
      >
        <input type="hidden" name="type" value={params.asoType} />
        <input type="hidden" name="mode" value={params.mode} />

        <div className="w-full space-y-1 lg:w-28">
          <label htmlFor="aso-year" className="text-[11px] font-medium text-slate-500">
            Ano
          </label>
          <select
            id="aso-year"
            name="year"
            defaultValue={params.year}
            onChange={(e) => submitForm(e.currentTarget)}
            className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[13px] outline-none focus-visible:border-teal-600"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full space-y-1 lg:w-40">
          <label htmlFor="aso-month" className="text-[11px] font-medium text-slate-500">
            Competência
          </label>
          <select
            id="aso-month"
            name="month"
            defaultValue={params.month}
            onChange={(e) => submitForm(e.currentTarget)}
            className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[13px] outline-none focus-visible:border-teal-600"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {!hideRegion ? (
          <div className="w-full space-y-1 lg:w-44">
            <label htmlFor="aso-region" className="text-[11px] font-medium text-slate-500">
              Regional
            </label>
            <select
              id="aso-region"
              name="regionId"
              value={selectedRegion}
              disabled={lockRegion}
              onChange={(e) => {
                const form = e.currentTarget.form;
                const next = e.target.value;
                setSelectedRegion(next);
                setSelectedUnit("ALL");
                const unitEl = form?.elements.namedItem("unitId");
                if (unitEl instanceof HTMLSelectElement) {
                  unitEl.value = "ALL";
                }
                form?.requestSubmit();
              }}
              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[13px] outline-none focus-visible:border-teal-600 disabled:bg-slate-50"
            >
              {!lockRegion ? <option value="ALL">Todas</option> : null}
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        ) : params.regionId ? (
          <input type="hidden" name="regionId" value={params.regionId} />
        ) : null}

        {!hideUnit ? (
          <div className="w-full space-y-1 lg:w-56">
            <label htmlFor="aso-unit" className="text-[11px] font-medium text-slate-500">
              Unidade
            </label>
            <select
              id="aso-unit"
              name="unitId"
              value={selectedUnit}
              disabled={lockUnit}
              onChange={(e) => {
                setSelectedUnit(e.target.value);
                submitForm(e.currentTarget);
              }}
              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[13px] outline-none focus-visible:border-teal-600 disabled:bg-slate-50"
            >
              {!lockUnit ? <option value="ALL">Todas</option> : null}
              {filteredUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {formatUnitDisplayName(u.name)}
                </option>
              ))}
            </select>
          </div>
        ) : params.unitId ? (
          <input type="hidden" name="unitId" value={params.unitId} />
        ) : null}

        <div className="min-w-[200px] flex-1 space-y-1">
          <label htmlFor="aso-q" className="text-[11px] font-medium text-slate-500">
            Busca nominal
          </label>
          <input
            id="aso-q"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Nome ou matrícula — Enter para buscar"
            className="h-8 w-full rounded-md border border-slate-200 px-2.5 text-[13px] outline-none focus-visible:border-teal-600"
          />
        </div>

        <Button
          type="submit"
          size="sm"
          className="h-8 bg-teal-700 px-3 text-[13px] hover:bg-teal-800"
        >
          Buscar
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
        <div className="flex flex-wrap gap-1">
          {ASO_TYPE_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={buildAsoUrl("/asos", current, { type: tab.value, page: undefined })}
              className={cn(
                "rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors",
                params.asoType === tab.value
                  ? "bg-teal-700 text-white"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="flex overflow-hidden rounded-md border border-slate-200">
          <Link
            href={buildAsoUrl("/asos", current, { mode: "monthly" })}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-7 rounded-none px-3 text-[12.5px]",
              params.mode === "monthly" ? "bg-teal-700 text-white hover:bg-teal-700" : "",
            )}
          >
            Mensal
          </Link>
          <Link
            href={buildAsoUrl("/asos", current, { mode: "accumulated" })}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-7 rounded-none px-3 text-[12.5px]",
              params.mode === "accumulated" ? "bg-teal-700 text-white hover:bg-teal-700" : "",
            )}
          >
            Acumulado
          </Link>
        </div>
      </div>
    </div>
  );
}
