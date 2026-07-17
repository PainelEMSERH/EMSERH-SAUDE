import {
  EmptyState,
  PageHeader,
} from "@/components/feedback/setup-banner";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getDashboardBundle } from "@/db/queries/dashboard-bundle";
import { requirePermission } from "@/lib/auth/guard";
import { parseDashboardFilters } from "@/lib/dashboard/params";
import { isDatabaseConfigured } from "@/lib/env";
import type { DashboardFilterParams } from "@/lib/dashboard/params";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardFilterParams>;
}) {
  const configured = isDatabaseConfigured();
  const user = await requirePermission("dashboard", "view");
  const params = await searchParams;

  if (!configured) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          description="Visão consolidada da saúde ocupacional, pendências e indicadores da EMSERH."
        />
        <EmptyState
          title="Banco ainda não conectado"
          description="Configure o Neon (DATABASE_URL) e rode as migrações para popular os indicadores reais. Nenhuma métrica fictícia é exibida."
        />
      </div>
    );
  }

  const filters = parseDashboardFilters(user, params);
  const data = await getDashboardBundle(user, filters);

  if (!data.configured) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          description="Visão consolidada da saúde ocupacional, pendências e indicadores da EMSERH."
        />
        <EmptyState
          title="Banco ainda não conectado"
          description="Configure o Neon e rode as migrações."
        />
      </div>
    );
  }

  return <DashboardView data={data} user={user} />;
}
