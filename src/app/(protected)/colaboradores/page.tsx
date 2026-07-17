import Link from "next/link";
import { Database, Eye, Users } from "lucide-react";
import { EmployeeFilters } from "@/components/employees/employee-filters";
import { StatusBadge } from "@/components/feedback/status-badge";
import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/guard";
import { formatDateBR } from "@/lib/dates";
import {
  humanizeLabel,
  formatRegistrationDisplay,
  toneForFunctionalStatus,
} from "@/lib/labels";
import {
  listEmployees,
  listRegionsForUser,
  listUnitsForUser,
} from "@/db/queries/employees";
import { cn } from "@/lib/utils";

export default async function ColaboradoresPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    regionId?: string;
    unitId?: string;
    page?: string;
    notice?: string;
  }>;
}) {
  const user = await requirePermission("employees", "view");
  const params = await searchParams;

  const lockRegion = user.scopeLevel === "REGION";
  const lockUnit = user.scopeLevel === "UNIT";
  const hideRegion = user.scopeLevel === "UNIT";

  let regionId = params.regionId;
  let unitId = params.unitId;
  if (lockRegion && user.regionIds.length === 1) {
    regionId = user.regionIds[0];
  }
  if (lockUnit && user.unitIds.length === 1) {
    unitId = user.unitIds[0];
  }

  const [data, regions, units] = await Promise.all([
    listEmployees(user, {
      q: params.q,
      status: params.status,
      regionId,
      unitId,
      page: params.page,
    }),
    listRegionsForUser(user),
    listUnitsForUser(
      user,
      lockRegion && user.regionIds.length === 1
        ? user.regionIds[0]
        : regionId,
    ),
  ]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-teal-100 bg-teal-50 text-teal-800">
            <Users className="size-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Colaboradores
            </h2>
            <p className="text-[12px] text-slate-500">
              Base sincronizada pelo Alterdata · consulta por regional e unidade.
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
          <Database className="size-3.5 text-teal-700" aria-hidden />
          Dados do Alterdata
        </span>
      </div>

      {params.notice === "alterdata" ? (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
          Os colaboradores são cadastrados exclusivamente pelo Alterdata.
        </div>
      ) : null}

      <EmployeeFilters
        regions={regions.map((r) => ({ id: r.id, name: r.name }))}
        units={units.map((u) => ({
          id: u.id,
          name: u.name,
          regionId: u.regionId,
        }))}
        q={params.q}
        status={params.status}
        regionId={data.appliedRegionId}
        unitId={data.appliedUnitId}
        resultCount={data.total}
        filterLabel={data.filterLabel}
        lockRegion={lockRegion}
        lockUnit={lockUnit}
        hideRegion={hideRegion}
        hideUnit={false}
      />

      <DataTable
        stickyHeader
        stickyHeaderMode="page"
        tableLayout="fixed"
        rows={data.rows}
        emptyTitle="Nenhum colaborador encontrado"
        emptyDescription="Ajuste os filtros ou sincronize o espelho Alterdata."
        columns={[
          {
            key: "registration",
            header: "Matrícula",
            className: "w-[7%] text-center whitespace-nowrap",
            cell: (r) => (
              <Link
                href={`/colaboradores/${r.id}`}
                className="font-semibold text-teal-800 hover:underline"
                title={`Abrir prontuário de ${r.fullName}`}
              >
                {formatRegistrationDisplay(r.registration)}
              </Link>
            ),
          },
          {
            key: "name",
            header: "Nome",
            className: "w-[26%] text-left",
            cell: (r) => (
              <p
                className="truncate font-medium text-slate-900"
                title={r.fullName}
              >
                {r.fullName}
              </p>
            ),
          },
          {
            key: "unit",
            header: "Unidade",
            className: "w-[20%] text-left",
            cell: (r) => (
              <span
                className="block truncate text-slate-600"
                title={r.unitName ?? undefined}
              >
                {humanizeLabel(r.unitName)}
              </span>
            ),
          },
          {
            key: "role",
            header: "Função",
            className: "w-[18%] text-left",
            cell: (r) => (
              <span
                className="block truncate text-slate-600"
                title={r.jobRoleName ?? undefined}
              >
                {r.jobRoleName ?? "—"}
              </span>
            ),
          },
          {
            key: "region",
            header: "Regional",
            className: "w-[8%] text-left",
            cell: (r) => (
              <span
                className="block truncate text-slate-600"
                title={r.regionName ?? undefined}
              >
                {humanizeLabel(r.regionName)}
              </span>
            ),
          },
          {
            key: "status",
            header: "Situação",
            className: "w-[8%] text-center",
            cell: (r) => (
              <div className="flex justify-center">
                <StatusBadge
                  label={humanizeLabel(r.functionalStatus)}
                  tone={toneForFunctionalStatus(r.functionalStatus)}
                />
              </div>
            ),
          },
          {
            key: "admission",
            header: "Admissão",
            className: "w-[7%] text-center whitespace-nowrap",
            cell: (r) => (
              <span className="tabular-nums text-slate-600">
                {formatDateBR(r.admissionDate)}
              </span>
            ),
          },
          {
            key: "actions",
            header: "",
            className: "w-[6%] text-center",
            cell: (r) => (
              <Link
                href={`/colaboradores/${r.id}`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-7 gap-1 px-1.5 text-[11px] text-teal-800",
                )}
                title="Ver prontuário"
              >
                <Eye className="size-3" />
                Prontuário
              </Link>
            ),
          },
        ]}
      />

      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        total={data.total}
        pageSize={data.pageSize}
        itemLabel="colaboradores"
        basePath="/colaboradores"
        searchParams={{
          q: params.q,
          status: params.status,
          regionId: data.appliedRegionId,
          unitId: data.appliedUnitId,
        }}
      />
    </div>
  );
}
