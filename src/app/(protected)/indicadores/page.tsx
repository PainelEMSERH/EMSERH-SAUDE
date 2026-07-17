import { PageHeader } from "@/components/feedback/setup-banner";
import { StatusBadge } from "@/components/feedback/status-badge";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { seedIndicatorsAction } from "@/actions/indicators";
import { listIndicators } from "@/db/queries/indicators";
import { requirePermission, userCan } from "@/lib/auth/guard";

export default async function IndicadoresPage() {
  const user = await requirePermission("indicators", "view");
  const rows = await listIndicators();
  const canManage = userCan(user, "indicators", "manage");

  return (
    <div>
      <PageHeader
        title="Indicadores"
        description="Catálogo institucional de indicadores de saúde ocupacional."
        actions={
          canManage ? (
            <form
              action={async () => {
                "use server";
                await seedIndicatorsAction();
              }}
            >
              <Button type="submit" className="bg-primary hover:bg-primary-hover">
                Carregar catálogo base
              </Button>
            </form>
          ) : null
        }
      />
      <DataTable
        rows={rows}
        emptyTitle="Catálogo vazio"
        emptyDescription="Use “Carregar catálogo base” para inserir os indicadores iniciais (sem inventar resultados)."
        columns={[
          { key: "code", header: "Código", cell: (r) => r.code },
          { key: "name", header: "Nome", cell: (r) => r.name },
          { key: "cat", header: "Categoria", cell: (r) => r.category },
          {
            key: "status",
            header: "Validação",
            cell: (r) => (
              <StatusBadge
                label={r.ruleValidationStatus}
                tone={
                  r.ruleValidationStatus === "VALIDADA" ? "ok" : "warn"
                }
              />
            ),
          },
        ]}
      />
    </div>
  );
}
