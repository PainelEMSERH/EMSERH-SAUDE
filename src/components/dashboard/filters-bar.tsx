"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { MONTH_NAMES } from "@/lib/aso/constants";
import { buildDashboardUrl } from "@/lib/dashboard/params";
import { formatUnitDisplayName } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Opt = {
  id: string;
  name: string;
  code?: string | null;
  regionId?: string | null;
};

const selectClass =
  "block h-9 rounded-lg border border-border bg-white px-2.5 text-[13px] text-foreground outline-none transition-colors focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 disabled:opacity-70";

export function DashboardFiltersBar({
  years,
  regions,
  units,
  current,
  hideRegion,
  lockRegion,
  lockUnit,
}: {
  years: number[];
  regions: Opt[];
  units: Opt[];
  current: {
    year: number;
    month: number;
    regionId?: string;
    unitId?: string;
  };
  hideRegion?: boolean;
  lockRegion?: boolean;
  lockUnit?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const filteredUnits = current.regionId
    ? units.filter((u) => !u.regionId || u.regionId === current.regionId)
    : units;

  function go(overrides: Record<string, string | number | undefined>) {
    const href = buildDashboardUrl(
      {
        year: current.year,
        month: current.month,
        regionId: current.regionId,
        unitId: current.unitId,
      },
      overrides,
    );
    startTransition(() => router.push(href));
  }

  return (
    <form
      className={cn(
        "app-surface flex flex-wrap items-end gap-3 px-4 py-3",
        pending && "pointer-events-none opacity-60",
      )}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        go({
          year: String(fd.get("year") || current.year),
          month: String(fd.get("month") || current.month),
          regionId: hideRegion
            ? current.regionId
            : String(fd.get("regionId") || ""),
          unitId: String(fd.get("unitId") || ""),
        });
      }}
    >
      <label className="space-y-1 text-[11px] font-medium text-slate-500">
        Ano
        <select
          name="year"
          defaultValue={current.year}
          className={cn(selectClass, "min-w-[88px]")}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-[11px] font-medium text-slate-500">
        Competência
        <select
          name="month"
          defaultValue={current.month}
          className={cn(selectClass, "min-w-[128px]")}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          {MONTH_NAMES.map((name, idx) => (
            <option key={name} value={idx + 1}>
              {name}
            </option>
          ))}
        </select>
      </label>

      {!hideRegion ? (
        <label className="space-y-1 text-[11px] font-medium text-slate-500">
          Regional
          <select
            name="regionId"
            defaultValue={current.regionId || ""}
            disabled={lockRegion}
            className={cn(selectClass, "min-w-[168px]")}
            onChange={(e) => {
              const form = e.currentTarget.form;
              if (!form) return;
              const unit = form.elements.namedItem(
                "unitId",
              ) as HTMLSelectElement | null;
              if (unit) unit.value = "";
              form.requestSubmit();
            }}
          >
            <option value="">Consolidado EMSERH</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="space-y-1 text-[11px] font-medium text-slate-500">
        Unidade
        <select
          name="unitId"
          defaultValue={current.unitId || ""}
          disabled={lockUnit || (!current.regionId && !lockUnit)}
          className={cn(selectClass, "min-w-[220px]")}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          <option value="">Todas</option>
          {filteredUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {formatUnitDisplayName(u.name)}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
