import { PregnancyFilters } from "@/components/pregnancy/pregnancy-filters";
import { PregnancyPanelHeader } from "@/components/pregnancy/pregnancy-panel-header";
import { PregnancySummaryCards } from "@/components/pregnancy/pregnancy-summary-cards";
import { PregnancyTable } from "@/components/pregnancy/pregnancy-table";
import { Pagination } from "@/components/tables/pagination";
import {
  listPregnancies,
  type PregnancyListParams,
} from "@/db/queries/occupational";
import { requirePermission, userCan } from "@/lib/auth/guard";

export default async function GestantesPage({
  searchParams,
}: {
  searchParams: Promise<PregnancyListParams>;
}) {
  const user = await requirePermission("pregnancy", "view");
  const params = await searchParams;
  const canCreate = userCan(user, "pregnancy", "create");
  const canUpdate = userCan(user, "pregnancy", "update");

  const data = await listPregnancies(user, params);

  const current: Record<string, string | number | undefined> = {
    q: params.q,
    status: params.status,
    hazardous: params.hazardous,
    alert: params.alert,
  };

  return (
    <div>
      <PregnancyPanelHeader canCreate={canCreate} />

      <PregnancyFilters
        current={{
          q: params.q,
          status: params.status,
          hazardous: params.hazardous,
          alert: params.alert,
        }}
      />

      <PregnancySummaryCards metrics={data.metrics} current={current} />

      <PregnancyTable rows={data.rows} canUpdate={canUpdate} />

      <div className="mt-3">
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
          itemLabel="gestantes"
          basePath="/gestantes"
          searchParams={{
            q: params.q,
            status: params.status,
            hazardous: params.hazardous,
            alert: params.alert,
          }}
        />
      </div>
    </div>
  );
}
