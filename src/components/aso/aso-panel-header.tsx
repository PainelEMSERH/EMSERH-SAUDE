"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, ClipboardCheck, Download, RefreshCw } from "lucide-react";
import { generatePlanningAction, syncAlterdataAsoAction } from "@/actions/aso-panel";
import { AsoRegisterDialog } from "@/components/aso/aso-register-dialog";
import { Button } from "@/components/ui/button";
import { formatDateTimeBR } from "@/lib/dates";
import { humanizeLabel } from "@/lib/labels";

type PlanningState = { error?: string; ok?: boolean; message?: string };
const planningInitial: PlanningState = {};

export type LastSyncInfo = {
  status: string;
  updatedAt: Date | string | null;
  createdAt: Date | string | null;
  importedRows: number | null;
  updatedRows: number | null;
  errorRows: number | null;
} | null;

export function AsoPanelHeader({
  lastSync,
  canSync,
  canCreate,
  canManagePlanning,
  year,
  exportHref,
  canExport,
}: {
  lastSync: LastSyncInfo;
  canSync: boolean;
  canCreate: boolean;
  canManagePlanning: boolean;
  year: number;
  exportHref: string;
  canExport: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planningState, planningAction, planningPending] = useActionState(
    generatePlanningAction,
    planningInitial,
  );

  useEffect(() => {
    if (planningState.ok || planningState.error) {
      setMessage(planningState.message ?? null);
      setError(planningState.error ?? null);
    }
  }, [planningState]);

  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-teal-100 bg-teal-50 text-teal-800">
            <ClipboardCheck className="size-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Gestão de ASOs
            </h2>
            <p className="text-[12px] text-slate-500">
              Planejamento, execução e conciliação com o espelho Alterdata por competência.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lastSync ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600"
              title={lastSync.updatedAt ? formatDateTimeBR(lastSync.updatedAt) : undefined}
            >
              Última sinc.: {lastSync.updatedAt ? formatDateTimeBR(lastSync.updatedAt) : "—"} ·{" "}
              {humanizeLabel(lastSync.status)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
              Nenhuma sincronização registrada
            </span>
          )}

          {canSync ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              className="h-8 gap-1.5 text-[13px]"
              onClick={() => {
                setError(null);
                setMessage(null);
                startTransition(async () => {
                  const result = await syncAlterdataAsoAction();
                  if (result.error) setError(result.error);
                  if (result.ok && result.message) setMessage(result.message);
                });
              }}
            >
              <RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} />
              {pending ? "Sincronizando..." : "Sincronizar espelho"}
            </Button>
          ) : null}

          {canManagePlanning ? (
            <form action={planningAction}>
              <input type="hidden" name="year" value={year} />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={planningPending}
                className="h-8 gap-1.5 text-[13px]"
              >
                <CalendarClock className="size-3.5" />
                {planningPending ? "Gerando..." : `Gerar planejamento ${year}`}
              </Button>
            </form>
          ) : null}

          {canCreate ? <AsoRegisterDialog /> : null}

          {canExport ? (
            <Link
              href={exportHref}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="size-3.5" />
              Exportar
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-[12.5px] text-teal-800">
          {message}
        </p>
      ) : null}
    </div>
  );
}
