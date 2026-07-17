import { BiologicalFilters } from "@/components/biological/biological-filters";
import { BiologicalPanelHeader } from "@/components/biological/biological-panel-header";
import { BiologicalSummaryCards } from "@/components/biological/biological-summary-cards";
import { BiologicalTable } from "@/components/biological/biological-table";
import { Pagination } from "@/components/tables/pagination";
import {
  listBiologicalAccidents,
  type BiologicalListParams,
} from "@/db/queries/occupational";
import { requirePermission, userCan } from "@/lib/auth/guard";

export default async function MaterialBiologicoPage({
  searchParams,
}: {
  searchParams: Promise<BiologicalListParams>;
}) {
  const user = await requirePermission("biological", "view");
  const params = await searchParams;
  const canCreate = userCan(user, "biological", "create");
  const canUpdate = userCan(user, "biological", "update");
  const data = await listBiologicalAccidents(user, params);

  const current: Record<string, string | number | undefined> = {
    q: params.q,
    status: params.status,
    pep: params.pep,
    followup: params.followup,
  };

  return (
    <div>
      <BiologicalPanelHeader canCreate={canCreate} />

      <BiologicalFilters
        current={{
          q: params.q,
          status: params.status,
          pep: params.pep,
          followup: params.followup,
        }}
      />

      <BiologicalSummaryCards metrics={data.metrics} current={current} />

      <BiologicalTable rows={data.rows} canUpdate={canUpdate} />

      <div className="mt-3">
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
          itemLabel="acidentes"
          basePath="/material-biologico"
          searchParams={{
            q: params.q,
            status: params.status,
            pep: params.pep,
            followup: params.followup,
          }}
        />
      </div>
    </div>
  );
}
