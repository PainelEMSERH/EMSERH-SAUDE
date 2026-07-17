import { LeavesFilters } from "@/components/leaves/leaves-filters";
import { LeavesPanelHeader } from "@/components/leaves/leaves-panel-header";
import { LeavesSummaryCards } from "@/components/leaves/leaves-summary-cards";
import { LeavesTable } from "@/components/leaves/leaves-table";
import { Pagination } from "@/components/tables/pagination";
import {
  listLeaves,
  type LeavesListParams,
} from "@/db/queries/occupational";
import { requirePermission, userCan } from "@/lib/auth/guard";

export default async function AfastamentosPage({
  searchParams,
}: {
  searchParams: Promise<LeavesListParams>;
}) {
  const user = await requirePermission("leaves", "view");
  const params = await searchParams;
  const canViewClinical = userCan(user, "leaves", "view_clinical");
  const canCreate = userCan(user, "leaves", "create");
  const canUpdate = userCan(user, "leaves", "update");

  const data = await listLeaves(user, params, {
    includeClinical: canViewClinical,
  });

  const current: Record<string, string | number | undefined> = {
    q: params.q,
    status: params.status,
    leaveType: params.leaveType,
    returnPending: params.returnPending,
  };

  return (
    <div>
      <LeavesPanelHeader canCreate={canCreate} />

      <LeavesFilters
        current={{
          q: params.q,
          status: params.status,
          leaveType: params.leaveType,
          returnPending: params.returnPending,
        }}
      />

      <LeavesSummaryCards metrics={data.metrics} current={current} />

      <LeavesTable
        rows={data.rows}
        canViewClinical={canViewClinical}
        canUpdate={canUpdate}
      />

      <div className="mt-3">
        <Pagination
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          pageSize={data.pageSize}
          itemLabel="afastamentos"
          basePath="/afastamentos"
          searchParams={{
            q: params.q,
            status: params.status,
            leaveType: params.leaveType,
            returnPending: params.returnPending,
          }}
        />
      </div>
    </div>
  );
}
