import { PageHeader } from "@/components/feedback/setup-banner";
import { StatusBadge, deadlineTone } from "@/components/feedback/status-badge";
import { QuickCreateForm } from "@/components/forms/quick-create-form";
import { DataTable } from "@/components/tables/data-table";
import { Pagination } from "@/components/tables/pagination";
import { SearchFilters } from "@/components/tables/search-filters";
import { createAsoAction } from "@/actions/occupational";
import { listAsos } from "@/db/queries/occupational";
import { requirePermission, userCan } from "@/lib/auth/guard";
import { formatDateBR } from "@/lib/dates";

export default async function AsosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; page?: string }>;
}) {
  const user = await requirePermission("asos", "view");
  const params = await searchParams;
  const data = await listAsos(user, params);
  const canCreate = userCan(user, "asos", "create");

  return (
    <div>
      <PageHeader
        title="ASOs"
        description="Exames ocupacionais com vencimento calculado por meses reais."
      />
      {canCreate ? (
        <QuickCreateForm
          action={createAsoAction}
          onSuccessPath="/asos"
          submitLabel="Registrar ASO"
          fields={[
            { name: "registration", label: "Matrícula", required: true },
            {
              name: "asoType",
              label: "Tipo",
              type: "select",
              required: true,
              options: [
                { value: "PERIODICO", label: "Periódico" },
                { value: "ADMISSIONAL", label: "Admissional" },
                { value: "DEMISSIONAL", label: "Demissional" },
                { value: "RETORNO_TRABALHO", label: "Retorno ao trabalho" },
                { value: "MUDANCA_RISCO", label: "Mudança de risco" },
              ],
            },
            { name: "performedDate", label: "Data realizada", type: "date" },
            { name: "expectedDate", label: "Data prevista", type: "date" },
            {
              name: "periodicityMonths",
              label: "Periodicidade (meses)",
              type: "number",
              defaultValue: "12",
            },
            {
              name: "result",
              label: "Resultado",
              type: "select",
              options: [
                { value: "APTO", label: "Apto" },
                { value: "INAPTO", label: "Inapto" },
                { value: "APTO_COM_RESTRICAO", label: "Apto com restrição" },
              ],
            },
            { name: "adminNotes", label: "Observação administrativa", type: "textarea" },
          ]}
        />
      ) : null}
      <SearchFilters
        action="/asos"
        q={params.q}
        status={params.status}
        statusOptions={[
          { value: "EM_DIA", label: "Em dia" },
          { value: "A_VENCER", label: "A vencer" },
          { value: "VENCIDO", label: "Vencido" },
        ]}
        type={params.type}
        typeName="type"
        typeLabel="Tipo ASO"
        typeOptions={[
          { value: "PERIODICO", label: "Periódico" },
          { value: "ADMISSIONAL", label: "Admissional" },
          { value: "DEMISSIONAL", label: "Demissional" },
          { value: "RETORNO_TRABALHO", label: "Retorno" },
        ]}
      />
      <DataTable
        rows={data.rows}
        emptyTitle="Nenhum ASO"
        emptyDescription="Registre ou importe ASOs para acompanhar vencimentos."
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
          { key: "type", header: "Tipo", cell: (r) => r.asoType },
          {
            key: "next",
            header: "Próximo ASO",
            cell: (r) => formatDateBR(r.nextAsoDate),
          },
          {
            key: "deadline",
            header: "Prazo",
            cell: (r) => (
              <StatusBadge
                label={r.deadlineStatus ?? "—"}
                tone={deadlineTone(r.deadlineStatus)}
              />
            ),
          },
          { key: "result", header: "Resultado", cell: (r) => r.result ?? "—" },
          { key: "unit", header: "Unidade", cell: (r) => r.unitName ?? "—" },
        ]}
      />
      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        basePath="/asos"
        searchParams={{ q: params.q, status: params.status, type: params.type }}
      />
    </div>
  );
}
