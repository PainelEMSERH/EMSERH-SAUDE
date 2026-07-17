import { PageHeader } from "@/components/feedback/setup-banner";
import { StatusBadge } from "@/components/feedback/status-badge";
import { QuickCreateForm } from "@/components/forms/quick-create-form";
import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { SearchFilters } from "@/components/tables/search-filters";
import { createLeaveAction } from "@/actions/occupational";
import { listLeaves } from "@/db/queries/occupational";
import { requirePermission, userCan } from "@/lib/auth/guard";
import { formatDateBR } from "@/lib/dates";

export default async function AfastamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const user = await requirePermission("leaves", "view");
  const params = await searchParams;
  const data = await listLeaves(user, params);
  const canCreate = userCan(user, "leaves", "create");

  return (
    <div>
      <PageHeader
        title="Afastamentos"
        description="Atestados, INSS, licenças e histórico preservado."
      />
      {canCreate ? (
        <QuickCreateForm
          action={createLeaveAction}
          onSuccessPath="/afastamentos"
          submitLabel="Registrar afastamento"
          fields={[
            { name: "registration", label: "Matrícula", required: true },
            {
              name: "leaveType",
              label: "Tipo",
              type: "select",
              required: true,
              options: [
                { value: "ATESTADO", label: "Atestado" },
                { value: "INSS", label: "INSS" },
                { value: "LICENCA_MATERNIDADE", label: "Licença-maternidade" },
                { value: "LICENCA_PATERNIDADE", label: "Licença-paternidade" },
                { value: "ACIDENTE", label: "Acidente" },
                { value: "OUTRO", label: "Outro" },
              ],
            },
            { name: "startDate", label: "Início", type: "date", required: true },
            { name: "endDate", label: "Fim", type: "date" },
            { name: "cidCode", label: "CID" },
            { name: "reasonSimplified", label: "Motivo simplificado" },
            { name: "reason", label: "Motivo", type: "textarea" },
            {
              name: "status",
              label: "Status",
              type: "select",
              defaultValue: "ATIVO",
              options: [
                { value: "ATIVO", label: "Ativo" },
                { value: "ENCERRADO", label: "Encerrado" },
              ],
            },
          ]}
        />
      ) : null}
      <SearchFilters
        action="/afastamentos"
        q={params.q}
        status={params.status}
        statusOptions={[
          { value: "ATIVO", label: "Ativo" },
          { value: "ENCERRADO", label: "Encerrado" },
        ]}
      />
      <DataTable
        rows={data.rows}
        emptyTitle="Sem afastamentos"
        emptyDescription="Nenhum afastamento no escopo atual."
        columns={[
          {
            key: "emp",
            header: "Colaborador",
            cell: (r) => (
              <div>
                <p className="font-medium">{r.fullName}</p>
                <p className="text-xs text-slate-500">{r.registration}</p>
              </div>
            ),
          },
          { key: "type", header: "Tipo", cell: (r) => r.leaveType },
          {
            key: "period",
            header: "Período",
            cell: (r) =>
              `${formatDateBR(r.startDate)} → ${formatDateBR(r.endDate)}`,
          },
          {
            key: "days",
            header: "Dias",
            cell: (r) => r.daysCount ?? "—",
          },
          { key: "cid", header: "CID", cell: (r) => r.cidCode ?? "—" },
          {
            key: "status",
            header: "Status",
            cell: (r) => (
              <StatusBadge
                label={r.status}
                tone={r.status === "ATIVO" ? "warn" : "ok"}
              />
            ),
          },
        ]}
      />
      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        basePath="/afastamentos"
        searchParams={{ q: params.q, status: params.status }}
      />
    </div>
  );
}
