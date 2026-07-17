import { PageHeader } from "@/components/feedback/setup-banner";
import { StatusBadge } from "@/components/feedback/status-badge";
import { QuickCreateForm } from "@/components/forms/quick-create-form";
import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { SearchFilters } from "@/components/tables/search-filters";
import { createVaccinationAction } from "@/actions/occupational";
import { listVaccinations } from "@/db/queries/occupational";
import { requirePermission, userCan } from "@/lib/auth/guard";
import { formatDateBR } from "@/lib/dates";

export default async function VacinacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requirePermission("vaccination", "view");
  const params = await searchParams;
  const data = await listVaccinations(user, params);
  const canCreate = userCan(user, "vaccination", "create");

  return (
    <div>
      <PageHeader
        title="Vacinação"
        description="Doses independentes por vacina. Situação vacinal institucional permanece configurável."
      />
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Regra de atualização vacinal: <strong>pendente de validação institucional</strong>.
        Enquanto isso, exibimos registros de dose sem inventar percentual consolidado.
      </div>
      {canCreate ? (
        <QuickCreateForm
          action={createVaccinationAction}
          onSuccessPath="/vacinacao"
          submitLabel="Registrar dose"
          fields={[
            { name: "registration", label: "Matrícula", required: true },
            {
              name: "vaccineCode",
              label: "Vacina",
              type: "select",
              required: true,
              options: [
                { value: "TETANO", label: "Tétano" },
                { value: "HEPATITE_B", label: "Hepatite B" },
                { value: "TRIPLICE", label: "Tríplice viral" },
                { value: "FEBRE_AMARELA", label: "Febre amarela" },
                { value: "H1N1", label: "Influenza/H1N1" },
                { value: "COVID", label: "COVID-19" },
              ],
            },
            {
              name: "doseNumber",
              label: "Nº da dose",
              type: "number",
              required: true,
              defaultValue: "1",
            },
            { name: "administeredAt", label: "Data", type: "date" },
            { name: "lotNumber", label: "Lote" },
            { name: "notes", label: "Observação", type: "textarea" },
          ]}
        />
      ) : null}
      <SearchFilters action="/vacinacao" q={params.q} />
      <DataTable
        rows={data.rows}
        emptyTitle="Sem doses registradas"
        emptyDescription="Cadastre doses por vacina e colaborador."
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
          { key: "vac", header: "Vacina", cell: (r) => r.vaccineName ?? "—" },
          { key: "dose", header: "Dose", cell: (r) => String(r.doseNumber) },
          {
            key: "date",
            header: "Aplicação",
            cell: (r) => formatDateBR(r.administeredAt),
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
        basePath="/vacinacao"
        searchParams={{ q: params.q }}
      />
    </div>
  );
}
