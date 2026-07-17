import { FileSpreadsheet } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { REPORT_DEFINITIONS } from "@/lib/reports/definitions";
import { cn } from "@/lib/utils";

export default async function RelatoriosPage() {
  await requirePermission("reports", "export");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-primary-border bg-primary-soft text-primary">
            <FileSpreadsheet className="size-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Relatórios
            </h2>
            <p className="text-[12px] text-muted-foreground">
              Excel pronto pra usar: cabeçalho verde EMSERH, Calibri 12, uma aba
              por relatório. Escopo do usuário e auditoria no download.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-3 app-surface overflow-hidden">
        <div className="border-b border-border-subtle bg-muted/70 px-3.5 py-2 text-[11px] text-muted-foreground">
          Formato:{" "}
          <span className="font-semibold text-foreground/80">.xlsx</span>
          <span className="mx-1.5 text-border">·</span>
          Fonte <span className="font-semibold text-foreground/80">Calibri 12</span>
          <span className="mx-1.5 text-border">·</span>
          Cabeçalho{" "}
          <span className="font-semibold text-primary">verde institucional</span>
          <span className="mx-1.5 text-border">·</span>
          Sem abas extras
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {REPORT_DEFINITIONS.map((r) => {
          const Icon = r.icon;
          return (
            <article
              key={r.key}
              className="app-surface flex flex-col overflow-hidden"
            >
              <div className="flex items-start gap-3 border-b border-border-subtle px-4 py-3.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-primary-border bg-primary-soft text-primary">
                  <Icon className="size-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
                    {r.title}
                  </h3>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                    {r.description}
                  </p>
                </div>
              </div>
              <div className="flex flex-1 flex-col px-4 py-3">
                <p className="text-[12px] leading-relaxed text-foreground/80">
                  {r.detail}
                </p>
                <div className="mt-auto pt-3">
                  <a
                    href={`/api/reports/${r.key}`}
                    className={cn(
                      "inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary-hover",
                    )}
                  >
                    Baixar Excel
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
