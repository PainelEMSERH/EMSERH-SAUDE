import { PageHeader } from "@/components/feedback/setup-banner";
import { StatusBadge } from "@/components/feedback/status-badge";
import { QuickCreateForm } from "@/components/forms/quick-create-form";
import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { SearchFilters } from "@/components/tables/search-filters";
import { createAppointmentAction } from "@/actions/occupational";
import { listAppointments } from "@/db/queries/occupational";
import { requirePermission, userCan } from "@/lib/auth/guard";
import { formatDateTimeBR } from "@/lib/dates";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const user = await requirePermission("agenda", "view");
  const params = await searchParams;
  const data = await listAppointments(user, params);
  const canCreate = userCan(user, "agenda", "create");

  return (
    <div>
      <PageHeader
        title="Agenda médica"
        description="Agendamentos por profissional, presença e conduta."
      />
      {canCreate ? (
        <QuickCreateForm
          action={createAppointmentAction}
          onSuccessPath="/agenda"
          submitLabel="Agendar"
          fields={[
            { name: "registration", label: "Matrícula", required: true },
            {
              name: "appointmentType",
              label: "Tipo",
              type: "select",
              required: true,
              options: [
                { value: "PERIODICO", label: "Periódico" },
                { value: "ADMISSIONAL", label: "Admissional" },
                { value: "DEMISSIONAL", label: "Demissional" },
                { value: "CONSULTA", label: "Consulta" },
                { value: "RETORNO_TRABALHO", label: "Retorno ao trabalho" },
              ],
            },
            {
              name: "scheduledAt",
              label: "Data/hora",
              type: "datetime-local",
              required: true,
            },
            { name: "physicianName", label: "Médico" },
            {
              name: "presenceStatus",
              label: "Presença",
              type: "select",
              options: [
                { value: "PRESENTE", label: "Presente" },
                { value: "AUSENTE", label: "Ausente" },
                { value: "REALIZADA", label: "Realizada" },
              ],
            },
            {
              name: "conduct",
              label: "Conduta",
              type: "select",
              options: [
                { value: "ORIENTACAO", label: "Orientação" },
                { value: "ATESTADO", label: "Atestado" },
                { value: "ACIDENTE", label: "Acidente" },
                { value: "NA", label: "N/A" },
              ],
            },
            {
              name: "result",
              label: "Resultado",
              type: "select",
              options: [
                { value: "APTO", label: "Apto" },
                { value: "INAPTO", label: "Inapto" },
              ],
            },
            { name: "weightKg", label: "Peso (kg)", type: "number" },
            { name: "heightCm", label: "Altura (cm)", type: "number" },
          ]}
        />
      ) : null}
      <SearchFilters
        action="/agenda"
        q={params.q}
        status={params.status}
        statusOptions={[
          { value: "PRESENTE", label: "Presente" },
          { value: "AUSENTE", label: "Ausente" },
          { value: "REALIZADA", label: "Realizada" },
        ]}
      />
      <DataTable
        rows={data.rows}
        emptyTitle="Agenda vazia"
        emptyDescription="Nenhum atendimento encontrado."
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
          { key: "type", header: "Tipo", cell: (r) => r.appointmentType },
          {
            key: "when",
            header: "Horário",
            cell: (r) => formatDateTimeBR(r.scheduledAt),
          },
          { key: "doc", header: "Médico", cell: (r) => r.physicianName ?? "—" },
          {
            key: "presence",
            header: "Presença",
            cell: (r) => (
              <StatusBadge label={r.presenceStatus ?? "—"} tone="info" />
            ),
          },
          { key: "conduct", header: "Conduta", cell: (r) => r.conduct ?? "—" },
        ]}
      />
      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        basePath="/agenda"
        searchParams={{ q: params.q, status: params.status }}
      />
    </div>
  );
}
