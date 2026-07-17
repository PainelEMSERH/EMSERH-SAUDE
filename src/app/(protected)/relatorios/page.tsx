import { PageHeader } from "@/components/feedback/setup-banner";
import { buttonVariants } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/guard";
import { cn } from "@/lib/utils";

const REPORTS = [
  {
    key: "employees",
    title: "Colaboradores",
    description: "Matrícula, nome, unidade, regional e situação.",
  },
  {
    key: "asos",
    title: "ASOs",
    description: "Tipo, próximo ASO e status de prazo.",
  },
  {
    key: "leaves",
    title: "Afastamentos",
    description: "Tipo, período, dias e status.",
  },
  {
    key: "vaccinations",
    title: "Vacinação",
    description: "Doses registradas por colaborador.",
  },
];

export default async function RelatoriosPage() {
  await requirePermission("reports", "export");

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Exportações CSV com escopo do usuário e auditoria de download."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {REPORTS.map((r) => (
          <div
            key={r.key}
            className="rounded-xl border border-border bg-card p-4"
          >
            <h3 className="font-semibold text-foreground">{r.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
            <a
              href={`/api/reports/${r.key}`}
              className={cn(
                buttonVariants({ className: "mt-4 bg-primary hover:bg-primary-hover" }),
              )}
            >
              Baixar CSV
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
