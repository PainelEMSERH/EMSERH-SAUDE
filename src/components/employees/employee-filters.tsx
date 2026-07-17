"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUnitDisplayName } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Opt = { id: string; name: string };
type UnitOpt = Opt & { regionId: string | null };

export function EmployeeFilters({
  regions,
  units,
  q,
  status,
  regionId,
  unitId,
  resultCount,
  filterLabel,
  lockRegion,
  lockUnit,
  hideRegion,
  hideUnit,
}: {
  regions: Opt[];
  units: UnitOpt[];
  q?: string;
  status?: string;
  regionId?: string;
  unitId?: string;
  resultCount: number;
  filterLabel?: string;
  lockRegion?: boolean;
  lockUnit?: boolean;
  hideRegion?: boolean;
  hideUnit?: boolean;
}) {
  const [selectedRegion, setSelectedRegion] = useState(regionId || "ALL");
  const [selectedUnit, setSelectedUnit] = useState(unitId || "ALL");

  const filteredUnits = useMemo(() => {
    if (!selectedRegion || selectedRegion === "ALL") return units;
    return units.filter((u) => u.regionId === selectedRegion);
  }, [units, selectedRegion]);

  const hasActive =
    Boolean(q?.trim()) ||
    Boolean(status && status !== "ALL") ||
    (selectedRegion !== "ALL" && !lockRegion) ||
    (selectedUnit !== "ALL" && !lockUnit);

  return (
    <div className="app-surface mb-3 space-y-2 p-3.5">
      <form
        action="/colaboradores"
        method="get"
        className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end"
      >
        <div className="min-w-[200px] flex-1 space-y-1">
          <label
            htmlFor="emp-q"
            className="text-[11px] font-medium text-muted-foreground"
          >
            Busca
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="emp-q"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Buscar por nome ou matrícula"
              className="h-8 pl-8 text-[13px]"
            />
          </div>
        </div>

        {!hideRegion ? (
          <div className="w-full space-y-1 lg:w-44">
            <label
              htmlFor="emp-region"
              className="text-[11px] font-medium text-muted-foreground"
            >
              Regional
            </label>
            <select
              id="emp-region"
              name="regionId"
              value={selectedRegion}
              disabled={lockRegion}
              onChange={(e) => {
                setSelectedRegion(e.target.value);
                setSelectedUnit("ALL");
              }}
              className="h-8 w-full rounded-md border border-border bg-card px-2 text-[13px] outline-none focus-visible:border-primary disabled:bg-muted"
            >
              {!lockRegion ? <option value="ALL">Todas</option> : null}
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {!hideUnit ? (
          <div className="w-full space-y-1 lg:w-56">
            <label
              htmlFor="emp-unit"
              className="text-[11px] font-medium text-muted-foreground"
            >
              Unidade
            </label>
            <select
              id="emp-unit"
              name="unitId"
              value={selectedUnit}
              disabled={lockUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-card px-2 text-[13px] outline-none focus-visible:border-primary disabled:bg-muted"
            >
              {!lockUnit ? <option value="ALL">Todas</option> : null}
              {filteredUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {formatUnitDisplayName(u.name)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          lockUnit && unitId ? (
            <input type="hidden" name="unitId" value={unitId} />
          ) : null
        )}

        {hideRegion && lockRegion && regionId ? (
          <input type="hidden" name="regionId" value={regionId} />
        ) : null}

        <div className="w-full space-y-1 lg:w-40">
          <label
            htmlFor="emp-status"
            className="text-[11px] font-medium text-muted-foreground"
          >
            Situação
          </label>
          <select
            id="emp-status"
            name="status"
            defaultValue={status || "ALL"}
            className="h-8 w-full rounded-md border border-border bg-card px-2 text-[13px] outline-none focus-visible:border-primary"
          >
            <option value="ALL">Todas</option>
            <option value="ATIVO">Ativo</option>
            <option value="AFASTADO">Afastado</option>
            <option value="FERIAS">Férias</option>
            <option value="DEMITIDO">Demitido</option>
            <option value="NAO_INFORMADO">Não informado</option>
          </select>
        </div>

        <div className="flex gap-1.5">
          <Button
            type="submit"
            size="sm"
            className="h-8 bg-primary px-3 text-[13px] hover:bg-primary-hover"
          >
            Filtrar
          </Button>
          {hasActive ? (
            <Link
              href="/colaboradores"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-8 text-[13px]",
              )}
            >
              Limpar
            </Link>
          ) : null}
        </div>
      </form>

      <p className="text-[12px] text-muted-foreground">
        <span className="font-medium text-foreground/80">
          {resultCount.toLocaleString("pt-BR")}
        </span>{" "}
        {resultCount === 1 ? "colaborador encontrado" : "colaboradores encontrados"}
        {filterLabel ? ` ${filterLabel}` : ""}
      </p>
    </div>
  );
}
