import { PageHeader } from "@/components/feedback/setup-banner";
import { StatusBadge } from "@/components/feedback/status-badge";
import { QuickCreateForm } from "@/components/forms/quick-create-form";
import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { SearchFilters } from "@/components/tables/search-filters";
import { createBiologicalAccidentAction } from "@/actions/occupational";
import { listBiologicalAccidents } from "@/db/queries/occupational";
import { requirePermission, userCan } from "@/lib/auth/guard";
import { formatDateTimeBR } from "@/lib/dates";

export default async function MaterialBiologicoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const user = await requirePermission("biological", "view");
  const params = await searchParams;
  const data = await listBiologicalAccidents(user, params);
  const canCreate = userCan(user, "biological", "create");

  return (
    <div>
      <PageHeader
        title="Material biológico"
        description="Acidentes com geração automática dos acompanhamentos 30/60/90."
      />
      {canCreate ? (
        <QuickCreateForm
          action={createBiologicalAccidentAction}
          onSuccessPath="/material-biologico"
          submitLabel="Registrar acidente"
          fields={[
            { name: "registration", label: "Matrícula", required: true },
            {
              name: "occurredAt",
              label: "Data/hora",
              type: "datetime-local",
              required: true,
            },
            { name: "exposureType", label: "Tipo de exposição" },
            { name: "bodyPart", label: "Parte do corpo" },
            {
              name: "pepStarted",
              label: "PEP iniciado?",
              type: "select",
              options: [
                { value: "true", label: "Sim" },
                { value: "false", label: "Não" },
              ],
            },
            { name: "catNumber", label: "Nº CAT" },
            { name: "description", label: "Descrição", type: "textarea" },
          ]}
        />
      ) : null}
      <SearchFilters
        action="/material-biologico"
        q={params.q}
        status={params.status}
        statusOptions={[
          { value: "EM_ACOMPANHAMENTO", label: "Em acompanhamento" },
          { value: "CONCLUIDO", label: "Concluído" },
        ]}
      />
      <DataTable
        rows={data.rows}
        emptyTitle="Nenhum acidente"
        emptyDescription="Registros de exposição biológica aparecerão aqui."
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
          {
            key: "when",
            header: "Ocorrência",
            cell: (r) => formatDateTimeBR(r.occurredAt),
          },
          {
            key: "type",
            header: "Exposição",
            cell: (r) => r.exposureType ?? "—",
          },
          {
            key: "pep",
            header: "PEP",
            cell: (r) => (r.pepStarted ? "Sim" : "Não"),
          },
          {
            key: "fu",
            header: "Follow-ups pendentes",
            cell: (r) => (
              <StatusBadge
                label={String(r.pendingFollowups ?? 0)}
                tone={(r.pendingFollowups ?? 0) > 0 ? "warn" : "ok"}
              />
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (r) => <StatusBadge label={r.status} tone="info" />,
          },
        ]}
      />
      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        basePath="/material-biologico"
        searchParams={{ q: params.q, status: params.status }}
      />
    </div>
  );
}
