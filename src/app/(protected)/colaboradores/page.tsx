import Link from "next/link";
import { Eye, UserPlus, Users } from "lucide-react";
import { StatusBadge } from "@/components/feedback/status-badge";
import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { SearchFilters } from "@/components/tables/search-filters";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission, userCan } from "@/lib/auth/guard";
import { formatDateBR } from "@/lib/dates";
import {
  humanizeLabel,
  toneForFunctionalStatus,
} from "@/lib/labels";
import { listEmployees } from "@/db/queries/employees";
import { cn } from "@/lib/utils";

export default async function ColaboradoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const user = await requirePermission("employees", "view");
  const params = await searchParams;
  const data = await listEmployees(user, params);
  const canCreate = userCan(user, "employees", "create");

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
              Cadastro único com lotação, vínculo e linha do tempo ocupacional.
            </p>
          </div>
        </div>
        {canCreate ? (
          <Link
            href="/colaboradores/novo"
            className={cn(
              buttonVariants({
                size: "sm",
                className: "h-8 shrink-0 gap-1.5 bg-teal-700 text-[13px] hover:bg-teal-800",
              }),
            )}
          >
            <UserPlus className="size-3.5" />
            Novo colaborador
          </Link>
        ) : null}
      </div>

      <SearchFilters
        action="/colaboradores"
        q={params.q}
        status={params.status}
        placeholder="Buscar por nome ou matrícula"
        resultCount={data.total}
        resultLabel={
          data.total === 1
            ? "colaborador encontrado"
            : "colaboradores encontrados"
        }
        statusOptions={[
          { value: "ATIVO", label: "Ativo" },
          { value: "AFASTADO", label: "Afastado" },
          { value: "DEMITIDO", label: "Demitido" },
          { value: "FERIAS", label: "Férias" },
        ]}
      />

      <DataTable
        rows={data.rows}
        emptyTitle="Nenhum colaborador encontrado"
        emptyDescription="Cadastre ou importe a base Alterdata para iniciar o prontuário ocupacional."
        columns={[
          {
            key: "registration",
            header: "Matrícula",
            className: "w-[100px]",
            cell: (r) => (
              <Link
                href={`/colaboradores/${r.id}`}
                className="font-semibold text-teal-800 hover:underline"
                title={`Abrir prontuário de ${r.fullName}`}
              >
                {r.registration}
              </Link>
            ),
          },
          {
            key: "name",
            header: "Nome",
            cell: (r) => (
              <p
                className="max-w-[220px] truncate font-medium text-slate-900"
                title={r.fullName}
              >
                {r.fullName}
              </p>
            ),
          },
          {
            key: "role",
            header: "Função",
            cell: (r) => (
              <span
                className="block max-w-[160px] truncate text-slate-600"
                title={r.jobRoleName ?? undefined}
              >
                {r.jobRoleName ?? "—"}
              </span>
            ),
          },
          {
            key: "unit",
            header: "Unidade",
            cell: (r) => (
              <span
                className="block max-w-[180px] truncate text-slate-600"
                title={r.unitName ?? undefined}
              >
                {humanizeLabel(r.unitName)}
              </span>
            ),
          },
          {
            key: "region",
            header: "Regional",
            cell: (r) => (
              <span
                className="block max-w-[100px] truncate text-slate-600"
                title={r.regionName ?? undefined}
              >
                {humanizeLabel(r.regionName)}
              </span>
            ),
          },
          {
            key: "status",
            header: "Situação",
            cell: (r) => (
              <StatusBadge
                label={humanizeLabel(r.functionalStatus)}
                tone={toneForFunctionalStatus(r.functionalStatus)}
              />
            ),
          },
          {
            key: "admission",
            header: "Admissão",
            cell: (r) => (
              <span className="tabular-nums text-slate-600">
                {formatDateBR(r.admissionDate)}
              </span>
            ),
          },
          {
            key: "actions",
            header: "",
            className: "w-[118px]",
            cell: (r) => (
              <Link
                href={`/colaboradores/${r.id}`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-7 gap-1 px-2 text-[12px] text-teal-800",
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
        searchParams={{ q: params.q, status: params.status }}
      />
    </div>
  );
}
