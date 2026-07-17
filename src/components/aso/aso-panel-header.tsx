"use client";

import { ClipboardCheck } from "lucide-react";
import { formatDateTimeBR } from "@/lib/dates";
import { humanizeImportBatchStatus } from "@/lib/aso/execution";

export type LastSyncInfo = {
  status: string;
  updatedAt: Date | string | null;
  createdAt: Date | string | null;
  importedRows: number | null;
  updatedRows: number | null;
  errorRows: number | null;
} | null;

/** Cabeçalho operacional — sem ações administrativas (ficam em /administracao). */
export function AsoPanelHeader({ lastSync }: { lastSync: LastSyncInfo }) {
  return (
    <div className="mb-5">
      <div className="app-page-header mb-0">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary-border bg-primary-soft text-primary">
            <ClipboardCheck className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2>Gestão de ASOs</h2>
            <p>
              Planejamento, execução e conciliação com o espelho Alterdata por
              competência.
            </p>
          </div>
        </div>

        {lastSync ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
            title={
              lastSync.updatedAt
                ? formatDateTimeBR(lastSync.updatedAt)
                : undefined
            }
          >
            Última sinc.:{" "}
            {lastSync.updatedAt ? formatDateTimeBR(lastSync.updatedAt) : "—"} ·{" "}
            {humanizeImportBatchStatus(lastSync.status)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-[color:var(--warning)]">
            Nenhuma sincronização registrada
          </span>
        )}
      </div>
    </div>
  );
}
