import { VaccinationFilters } from "@/components/vaccination/vaccination-filters";
import { VaccinationPanelHeader } from "@/components/vaccination/vaccination-panel-header";
import { VaccinationSummaryCards } from "@/components/vaccination/vaccination-summary-cards";
import { VaccinationTable } from "@/components/vaccination/vaccination-table";
import { Pagination } from "@/components/tables/pagination";
import {
  listVaccinations,
  type VaccinationListParams,
} from "@/db/queries/occupational";
import { requirePermission, userCan } from "@/lib/auth/guard";
import { vaccineLabel } from "@/lib/vaccination/constants";

export default async function VacinacaoPage({
  searchParams,
}: {
  searchParams: Promise<VaccinationListParams>;
}) {
  const user = await requirePermission("vaccination", "view");
  const params = await searchParams;
  const canCreate = userCan(user, "vaccination", "create");
  const data = await listVaccinations(user, params);

  const current: Record<string, string | number | undefined> = {
    q: params.q,
    vaccine: data.vaccine,
    situation: params.situation,
    kind: params.kind,
  };

  return (
    <div>
      <VaccinationPanelHeader
        canCreate={canCreate}
        defaultVaccine={data.vaccine}
      />

      <VaccinationFilters
        current={{
          q: params.q,
          vaccine: data.vaccine,
          situation: params.situation,
          kind: params.kind,
        }}
        vaccine={data.vaccine}
        tabCounts={data.tabCounts}
      />

      <VaccinationSummaryCards
        metrics={data.metrics}
        current={current}
        vaccineLabel={vaccineLabel(data.vaccine)}
      />

      <VaccinationTable rows={data.rows} />

      <div className="mt-3">
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
          itemLabel="registros"
          basePath="/vacinacao"
          searchParams={{
            q: params.q,
            vaccine: data.vaccine,
            situation: params.situation,
            kind: params.kind,
          }}
        />
      </div>
    </div>
  );
}
