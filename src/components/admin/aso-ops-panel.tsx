"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarClock,
  ClipboardCheck,
  Download,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  cancelStaleMirrorSyncAction,
  generatePlanningAction,
  syncAlterdataAsoAction,
} from "@/actions/aso-panel";
import type { LastSyncInfo } from "@/components/aso/aso-panel-header";
import { Button } from "@/components/ui/button";
import { formatDateTimeBR } from "@/lib/dates";
import {
  humanizeImportBatchStatus,
  isSyncPossiblyStale,
} from "@/lib/aso/execution";

type PlanningState = { error?: string; ok?: boolean; message?: string };
const planningInitial: PlanningState = {};

function elapsedLabel(createdAt: Date | string | null | undefined): string | null {
  if (!createdAt) return null;
  const start = new Date(createdAt).getTime();
  if (Number.isNaN(start)) return null;
  const mins = Math.floor((Date.now() - start) / 60_000);
  if (mins < 1) return "menos de 1 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h} h ${mins % 60} min`;
}

/** Operações de ASO restritas à Administração. */
export function AdminAsoOpsPanel({
  lastSync,
  year,
  canSync,
  canManagePlanning,
  canExport,
}: {
  lastSync: LastSyncInfo;
  year: number;
  canSync: boolean;
  canManagePlanning: boolean;
  canExport: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [cancelPending, startCancel] = useTransition();
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

  const status = lastSync?.status?.toUpperCase() ?? "";
  const isRunning = status === "RUNNING";
  const isStale = isSyncPossiblyStale(lastSync?.createdAt, lastSync?.status);
  const syncBlocked = (isRunning && !isStale) || pending;
  const processed =
    (lastSync?.importedRows ?? 0) + (lastSync?.updatedRows ?? 0);

  if (!canSync && !canManagePlanning && !canExport) {
    return (
      <p className="text-[13px] text-slate-500">
        Seu perfil não executa operações de ASO.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {lastSync ? (
          <span
            className={
              isRunning
                ? "inline-flex max-w-md flex-col gap-0.5 rounded-md border border-primary-border bg-primary-soft px-2.5 py-1 text-[11px] font-medium text-primary"
                : "inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
            }
            title={
              lastSync.updatedAt
                ? formatDateTimeBR(lastSync.updatedAt)
                : undefined
            }
          >
            {isRunning ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-3 animate-spin" />
                  {isStale
                    ? "Possivelmente interrompida"
                    : "Sincronização em andamento"}
                </span>
                <span className="font-normal text-primary/80">
                  Início:{" "}
                  {lastSync.createdAt
                    ? formatDateTimeBR(lastSync.createdAt)
                    : "—"}
                  {elapsedLabel(lastSync.createdAt)
                    ? ` · decorridos ${elapsedLabel(lastSync.createdAt)}`
                    : ""}
                  {processed > 0 ? ` · processados ${processed}` : ""}
                </span>
              </>
            ) : (
              <>
                Última sinc.:{" "}
                {lastSync.updatedAt
                  ? formatDateTimeBR(lastSync.updatedAt)
                  : "—"}{" "}
                · {humanizeImportBatchStatus(lastSync.status)}
              </>
            )}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">
            Nenhuma sincronização registrada
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canSync && isStale ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={cancelPending}
            className="h-8 gap-1.5 text-[13px] text-amber-900"
            onClick={() => {
              setError(null);
              setMessage(null);
              startCancel(async () => {
                const result = await cancelStaleMirrorSyncAction();
                if (result.error) setError(result.error);
                if (result.ok && result.message) setMessage(result.message);
              });
            }}
          >
            {cancelPending ? "Cancelando..." : "Cancelar lote interrompido"}
          </Button>
        ) : null}

        {canSync ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={syncBlocked}
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
            <RefreshCw
              className={pending ? "size-3.5 animate-spin" : "size-3.5"}
            />
            {pending
              ? "Sincronizando..."
              : isRunning && !isStale
                ? "Aguarde sincronização"
                : "Sincronizar espelho ASO"}
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

        {canExport ? (
          <Link
            href={`/api/asos/export?year=${year}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[13px] font-medium text-foreground/80 shadow-sm hover:bg-muted"
          >
            <Download className="size-3.5" />
            Exportar ASOs ({year})
          </Link>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md border border-primary-border bg-primary-soft px-3 py-2 text-[12.5px] text-primary">
          {message}
        </p>
      ) : null}

      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-500">
        <ClipboardCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
        Dados de realização vêm do Alterdata. Não há cadastro manual de ASO nesta
        tela. Relatórios completos também estão em Relatórios.
      </p>
    </div>
  );
}
