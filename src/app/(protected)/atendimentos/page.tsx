import { PageHeader } from "@/components/feedback/setup-banner";
import { QuickCreateForm } from "@/components/forms/quick-create-form";
import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { createAttendanceAction } from "@/actions/indicators";
import { listAttendances } from "@/db/queries/indicators";
import { requirePermission, userCan } from "@/lib/auth/guard";
import { formatDateTimeBR } from "@/lib/dates";

export default async function AtendimentosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requirePermission("attendances", "view");
  const params = await searchParams;
  const data = await listAttendances(user, params);
  const canCreate = userCan(user, "attendances", "create");

  return (
    <div>
      <PageHeader
        title="Atendimentos"
        description="Atendimentos ambulatoriais e registros operacionais."
      />
      {canCreate ? (
        <QuickCreateForm
          action={createAttendanceAction}
          onSuccessPath="/atendimentos"
          submitLabel="Registrar atendimento"
          fields={[
            { name: "registration", label: "Matrícula", required: true },
            {
              name: "attendanceType",
              label: "Tipo",
              type: "select",
              required: true,
              options: [
                { value: "AMBULATORIAL", label: "Ambulatorial" },
                { value: "EXTERNO", label: "Externo" },
                { value: "ESPACO_CUIDAR", label: "Espaço Cuidar" },
                { value: "COMISSAO", label: "Comissão" },
              ],
            },
            {
              name: "attendedAt",
              label: "Data/hora",
              type: "datetime-local",
              required: true,
            },
            { name: "conduct", label: "Conduta" },
            { name: "notes", label: "Observações", type: "textarea" },
          ]}
        />
      ) : null}
      <DataTable
        rows={data.rows}
        emptyTitle="Sem atendimentos"
        emptyDescription="Registre atendimentos ambulatoriais ou importe a base."
        columns={[
          {
            key: "emp",
            header: "Colaborador",
            cell: (r) => (
              <div>
                <p className="font-medium">{r.fullName ?? "—"}</p>
                <p className="text-xs text-slate-500">{r.registration ?? ""}</p>
              </div>
            ),
          },
          { key: "type", header: "Tipo", cell: (r) => r.attendanceType },
          {
            key: "when",
            header: "Quando",
            cell: (r) => formatDateTimeBR(r.attendedAt),
          },
          { key: "conduct", header: "Conduta", cell: (r) => r.conduct ?? "—" },
        ]}
      />
      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        basePath="/atendimentos"
        searchParams={{ q: params.q }}
      />
    </div>
  );
}
