import Link from "next/link";
import { PageHeader } from "@/components/feedback/setup-banner";
import {
  StatusBadge,
} from "@/components/feedback/status-badge";
import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { SearchFilters } from "@/components/tables/search-filters";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission, userCan } from "@/lib/auth/guard";
import { formatDateBR } from "@/lib/dates";
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
      <PageHeader
        title="Colaboradores"
        description="Cadastro único com lotação, vínculo e linha do tempo ocupacional."
        actions={
          canCreate ? (
            <Link
              href="/colaboradores/novo"
              className={cn(buttonVariants({ className: "bg-teal-700 hover:bg-teal-800" }))}
            >
              Novo colaborador
            </Link>
          ) : null
        }
      />
      <SearchFilters
        action="/colaboradores"
        q={params.q}
        status={params.status}
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
            cell: (r) => (
              <Link href={`/colaboradores/${r.id}`} className="font-medium text-teal-800 hover:underline">
                {r.registration}
              </Link>
            ),
          },
          { key: "name", header: "Nome", cell: (r) => r.fullName },
          { key: "role", header: "Função", cell: (r) => r.jobRoleName ?? "—" },
          { key: "unit", header: "Unidade", cell: (r) => r.unitName ?? "—" },
          { key: "region", header: "Regional", cell: (r) => r.regionName ?? "—" },
          {
            key: "status",
            header: "Situação",
            cell: (r) => (
              <StatusBadge
                label={r.functionalStatus}
                tone={r.functionalStatus === "ATIVO" ? "ok" : r.functionalStatus === "DEMITIDO" ? "danger" : "warn"}
              />
            ),
          },
          {
            key: "admission",
            header: "Admissão",
            cell: (r) => formatDateBR(r.admissionDate),
          },
        ]}
      />
      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        basePath="/colaboradores"
        searchParams={{ q: params.q, status: params.status }}
      />
    </div>
  );
}
