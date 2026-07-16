import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EmptyState,
  PageHeader,
} from "@/components/feedback/setup-banner";
import { getCurrentUser } from "@/lib/auth/session";
import { isDatabaseConfigured } from "@/lib/env";
import { getDashboardMetrics } from "@/db/queries/dashboard";

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "danger" | "warn" | "ok";
}) {
  const toneClass =
    tone === "danger"
      ? "text-red-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "ok"
          ? "text-teal-700"
          : "text-slate-900";

  return (
    <Card className="border-slate-200 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-semibold tabular-nums ${toneClass}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const configured = isDatabaseConfigured();
  const user = configured ? await getCurrentUser() : null;
  const metrics = await getDashboardMetrics(user);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visão operacional da saúde ocupacional no escopo do seu perfil."
      />

      {!configured ? (
        <EmptyState
          title="Banco ainda não conectado"
          description="Configure o Neon (DATABASE_URL) e rode as migrações para popular os indicadores reais. Nenhuma métrica fictícia é exibida."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Colaboradores ativos" value={metrics.activeEmployees} />
          <MetricCard label="ASOs vencidos" value={metrics.asoOverdue} tone="danger" />
          <MetricCard label="ASOs a vencer (30 dias)" value={metrics.asoDueSoon} tone="warn" />
          <MetricCard label="ASOs previstos no período" value={metrics.asoExpectedPeriod} />
          <MetricCard label="ASOs realizados (mês)" value={metrics.asoPerformed} tone="ok" />
          <MetricCard label="Afastamentos ativos" value={metrics.activeLeaves} />
          <MetricCard label="Gestantes em acompanhamento" value={metrics.pregnancies} />
          <MetricCard
            label="Gestantes insalubres s/ realocação"
            value={metrics.hazardousWithoutRelocation}
            tone="danger"
          />
          <MetricCard label="Acidentes material biológico" value={metrics.bioAccidents} />
          <MetricCard
            label="Acompanhamentos 30/60/90 pendentes"
            value={metrics.pendingFollowups}
            tone="warn"
          />
        </div>
      )}
    </div>
  );
}
