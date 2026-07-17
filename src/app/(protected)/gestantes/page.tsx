import { PageHeader } from "@/components/feedback/setup-banner";
import { StatusBadge } from "@/components/feedback/status-badge";
import { QuickCreateForm } from "@/components/forms/quick-create-form";
import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { SearchFilters } from "@/components/tables/search-filters";
import { createPregnancyAction } from "@/actions/occupational";
import { listPregnancies } from "@/db/queries/occupational";
import { requirePermission, userCan } from "@/lib/auth/guard";
import { formatDateBR } from "@/lib/dates";

export default async function GestantesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const user = await requirePermission("pregnancy", "view");
  const params = await searchParams;
  const data = await listPregnancies(user, params);
  const canCreate = userCan(user, "pregnancy", "create");

  return (
    <div>
      <PageHeader
        title="Gestantes"
        description="Comunicação, realocação e alertas de insalubridade."
      />
      {canCreate ? (
        <QuickCreateForm
          action={createPregnancyAction}
          onSuccessPath="/gestantes"
          submitLabel="Registrar caso"
          fields={[
            { name: "registration", label: "Matrícula", required: true },
            { name: "communicationDate", label: "Comunicação", type: "date" },
            { name: "proofType", label: "Tipo de comprovação" },
            {
              name: "hazardousActivity",
              label: "Atividade insalubre?",
              type: "select",
              options: [
                { value: "true", label: "Sim" },
                { value: "false", label: "Não" },
              ],
            },
            { name: "originSector", label: "Setor origem" },
            { name: "destinationSector", label: "Setor destino" },
            { name: "relocationDate", label: "Data realocação", type: "date" },
            {
              name: "status",
              label: "Status",
              type: "select",
              defaultValue: "EM_ACOMPANHAMENTO",
              options: [
                { value: "EM_ACOMPANHAMENTO", label: "Em acompanhamento" },
                { value: "APTO", label: "Apto / encerrado" },
                { value: "LICENCA", label: "Licença" },
              ],
            },
            { name: "notes", label: "Observações", type: "textarea" },
          ]}
        />
      ) : null}
      <SearchFilters
        action="/gestantes"
        q={params.q}
        status={params.status}
        statusOptions={[
          { value: "EM_ACOMPANHAMENTO", label: "Em acompanhamento" },
          { value: "APTO", label: "Apto" },
          { value: "LICENCA", label: "Licença" },
        ]}
      />
      <DataTable
        rows={data.rows}
        emptyTitle="Nenhuma gestante"
        emptyDescription="Sem casos no escopo atual."
        columns={[
          {
            key: "emp",
            header: "Colaboradora",
            cell: (r) => (
              <div>
                <p className="font-medium">{r.fullName}</p>
                <p className="text-xs text-slate-500">{r.registration}</p>
              </div>
            ),
          },
          {
            key: "comm",
            header: "Comunicação",
            cell: (r) => formatDateBR(r.communicationDate),
          },
          {
            key: "haz",
            header: "Insalubre",
            cell: (r) =>
              r.hazardousActivity ? (
                <StatusBadge
                  label={
                    r.relocationDate ? "Realocada" : "Sem realocação"
                  }
                  tone={r.relocationDate ? "ok" : "danger"}
                />
              ) : (
                "Não"
              ),
          },
          {
            key: "sectors",
            header: "Setores",
            cell: (r) =>
              `${r.originSector ?? "—"} → ${r.destinationSector ?? "—"}`,
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
        basePath="/gestantes"
        searchParams={{ q: params.q, status: params.status }}
      />
    </div>
  );
}
