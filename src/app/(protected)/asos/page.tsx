import { AsoFilters } from "@/components/aso/aso-filters";
import { AsoMatrix } from "@/components/aso/aso-matrix";
import {
  AsoNominalFilters,
  AsoNominalTable,
} from "@/components/aso/aso-nominal-table";
import { AsoPanelHeader } from "@/components/aso/aso-panel-header";
import { AsoSummaryCards } from "@/components/aso/aso-summary-cards";
import { Pagination } from "@/components/tables/pagination";
import { getAsoPanelData, type AsoPanelParams } from "@/db/queries/aso-panel";
import { requirePermission, userCan } from "@/lib/auth/guard";

export default async function AsosPage({
  searchParams,
}: {
  searchParams: Promise<AsoPanelParams>;
}) {
  const user = await requirePermission("asos", "view");
  const params = await searchParams;
  const data = await getAsoPanelData(user, params);

  const canCreate = userCan(user, "asos", "create");
  const canUpdate = userCan(user, "asos", "update");
  const canSync = userCan(user, "imports", "sync_global") || canUpdate;
  const canExport =
    userCan(user, "reports", "export") || userCan(user, "asos", "export");

  const hideRegion = user.scopeLevel === "UNIT";
  const lockRegion = user.scopeLevel === "REGION";
  const lockUnit = user.scopeLevel === "UNIT";

  const current: Record<string, string | number | undefined> = {
    year: data.year,
    month: data.month,
    regionId: data.regionId,
    unitId: data.unitId,
    type: data.asoType,
    mode: data.mode,
    q: params.q,
    execution: params.execution,
    alterdata: params.alterdata,
    functional: params.functional,
    pendingOnly: params.pendingOnly,
    divergencesOnly: params.divergencesOnly,
    priority: params.priority,
  };

  const exportParams = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (v !== undefined && String(v).trim() && String(v) !== "ALL") {
      exportParams.set(k, String(v));
    }
  }
  const exportHref = `/api/asos/export?${exportParams.toString()}`;

  const activeMatrixKey =
    data.unitId ??
    data.regionId ??
    (user.scopeLevel === "EMSERH" ? "EMSERH" : undefined);

  return (
    <div>
      <AsoPanelHeader
        lastSync={data.lastSync}
        canSync={canSync}
        canCreate={canCreate}
        canManagePlanning={canUpdate}
        year={data.year}
        exportHref={exportHref}
        canExport={canExport}
      />

      <AsoFilters
        years={data.years}
        regions={data.regions}
        units={data.units}
        params={{
          year: data.year,
          month: data.month,
          regionId: data.regionId,
          unitId: data.unitId,
          asoType: data.asoType,
          mode: data.mode === "accumulated" ? "accumulated" : "monthly",
          q: params.q,
        }}
        hideRegion={hideRegion}
        lockRegion={lockRegion}
        lockUnit={lockUnit}
      />

      <AsoSummaryCards
        metrics={data.metrics}
        closureStatus={data.closure?.status}
        current={current}
        asoType={data.asoType}
      />

      <AsoMatrix
        rows={data.matrixRows}
        activeMonth={data.month}
        activeKey={activeMatrixKey}
        current={current}
        unitCount={data.matrixUnitCount}
        unitSelected={Boolean(data.unitId)}
      />

      <AsoNominalFilters
        current={current}
        params={{
          execution: params.execution,
          alterdata: params.alterdata,
          functional: params.functional,
          pendingOnly: params.pendingOnly,
          divergencesOnly: params.divergencesOnly,
        }}
      />

      <AsoNominalTable
        rows={data.nominal.rows}
        canCreate={canCreate}
        canUpdate={canUpdate}
      />

      <Pagination
        page={data.nominal.page}
        totalPages={data.nominal.totalPages}
        total={data.nominal.total}
        pageSize={data.nominal.pageSize}
        itemLabel="itens"
        basePath="/asos"
        searchParams={{
          year: String(data.year),
          month: String(data.month),
          regionId: data.regionId,
          unitId: data.unitId,
          type: data.asoType,
          mode: data.mode,
          q: params.q,
          execution: params.execution,
          alterdata: params.alterdata,
          functional: params.functional,
          pendingOnly: params.pendingOnly,
          divergencesOnly: params.divergencesOnly,
          priority: params.priority,
        }}
      />
    </div>
  );
}
