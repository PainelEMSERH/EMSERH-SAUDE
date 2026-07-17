"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import { closeLeaveAction } from "@/actions/occupational";
import { StatusBadge } from "@/components/feedback/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { LeaveListRow } from "@/db/queries/occupational";
import { formatDateBR } from "@/lib/dates";
import {
  formatRegistrationDisplay,
  formatUnitDisplayName,
  humanizeLabel,
  initialsFromName,
} from "@/lib/labels";
import { leaveTypeLabel } from "@/lib/leaves/constants";
import { cn } from "@/lib/utils";

function toneForLeaveStatus(status: string): "ok" | "warn" | "muted" {
  return status === "ATIVO" ? "warn" : status === "ENCERRADO" ? "ok" : "muted";
}

function toneForLeaveType(type: string): "info" | "warn" | "danger" | "muted" | "ok" {
  if (type.startsWith("01") || type.includes("Afast")) return "warn";
  if (type.startsWith("10") || type.includes("Atestado")) return "info";
  if (type.startsWith("03") || type.startsWith("11") || type.includes("Matern"))
    return "ok";
  if (type.includes("ACIDENTE")) return "danger";
  return "muted";
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="app-surface overflow-hidden">
      <div className="border-b border-border-subtle bg-muted/80 px-3.5 py-2">
        <h4 className="text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
          {title}
        </h4>
      </div>
      <dl className="divide-y divide-border-subtle">{children}</dl>
    </section>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  const empty =
    value == null ||
    value === "" ||
    value === "—" ||
    (typeof value === "string" && !value.trim());

  return (
    <div className="flex items-start justify-between gap-4 px-3.5 py-2.5">
      <dt className="shrink-0 pt-0.5 text-[12px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-right text-[13px] leading-snug",
          empty ? "font-normal text-muted-foreground" : "font-medium text-foreground",
          mono && !empty ? "tabular-nums tracking-tight" : "",
        )}
      >
        {empty ? "—" : value}
      </dd>
    </div>
  );
}

function CloseLeaveForm({
  leaveId,
  defaultEnd,
  onClosed,
}: {
  leaveId: string;
  defaultEnd: string | null;
  onClosed?: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(closeLeaveAction, {});

  useEffect(() => {
    if (state.ok) {
      onClosed?.();
      router.refresh();
    }
  }, [state, router, onClosed]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <input type="hidden" name="leaveId" value={leaveId} />
      <p className="text-[12px] font-medium text-amber-950">Encerrar afastamento</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-amber-900/80">
          Data fim
          <input
            type="date"
            name="endDate"
            defaultValue={defaultEnd ?? today}
            className="mt-1 h-8 w-full rounded-md border border-amber-200 bg-card px-2 text-[13px]"
          />
        </label>
        <label className="text-[11px] text-amber-900/80">
          Retorno efetivo
          <input
            type="date"
            name="actualReturnDate"
            defaultValue={today}
            className="mt-1 h-8 w-full rounded-md border border-amber-200 bg-card px-2 text-[13px]"
          />
        </label>
      </div>
      {state.error ? (
        <p className="text-[11px] text-red-700">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={cn(
          buttonVariants({ size: "sm" }),
          "h-8 w-full bg-amber-800 text-[12px] hover:bg-amber-900",
        )}
      >
        {pending ? "Encerrando…" : "Confirmar encerramento"}
      </button>
    </form>
  );
}

export function LeavesTable({
  rows,
  canViewClinical,
  canUpdate,
}: {
  rows: LeaveListRow[];
  canViewClinical?: boolean;
  canUpdate?: boolean;
}) {
  const [selected, setSelected] = useState<LeaveListRow | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const returnHint = useMemo(() => {
    if (!selected) return "—";
    return selected.returnLabel === "—" ? "Não exigido" : selected.returnLabel;
  }, [selected]);

  return (
    <>
      <div className="app-section-title">
        <h3>Relação nominal</h3>
        <p>Clique na linha para ver detalhes</p>
      </div>
      <div className="app-surface">
        <table className="app-data-table">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[13%]" />
            <col className="w-[18%]" />
            <col className="w-[7%]" />
            <col className="w-[18%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[3%]" />
          </colgroup>
          <thead>
            <tr>
              <th className="text-left">Colaborador</th>
              <th className="text-center">Tipo</th>
              <th className="text-center">Período</th>
              <th className="text-center">Dias</th>
              <th className="text-left">Unidade</th>
              <th className="text-center">Status</th>
              <th className="text-center">Retorno</th>
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              return (
                <tr
                  key={r.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Abrir detalhes de ${r.fullName}`}
                  className="cursor-pointer focus-visible:bg-primary-soft focus-visible:outline-none"
                  onClick={() => setSelected(r)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(r);
                    }
                  }}
                >
                  <td className="text-left">
                    <p className="app-table-emphasis truncate capitalize">
                      {r.fullName.toLocaleLowerCase("pt-BR")}
                    </p>
                    <p className="app-table-meta text-primary">
                      {formatRegistrationDisplay(r.registration)}
                    </p>
                  </td>
                  <td className="text-center">
                    <div className="flex justify-center">
                      <StatusBadge
                        label={leaveTypeLabel(r.leaveType)}
                        tone={toneForLeaveType(r.leaveType)}
                      />
                    </div>
                  </td>
                  <td className="app-table-num">
                    {formatDateBR(r.startDate)}
                    <span className="mx-1 text-muted-foreground">→</span>
                    {formatDateBR(r.endDate)}
                  </td>
                  <td className="app-table-num">{r.daysCount ?? "—"}</td>
                  <td className="truncate text-left text-muted-foreground">
                    {formatUnitDisplayName(r.unitName)}
                  </td>
                  <td className="text-center">
                    <div className="flex justify-center">
                      <StatusBadge
                        label={humanizeLabel(r.displayStatus)}
                        tone={toneForLeaveStatus(r.displayStatus)}
                      />
                    </div>
                  </td>
                  <td className="text-center">
                    {r.returnLabel === "—" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex justify-center">
                        <StatusBadge
                          label={r.returnLabel}
                          tone={r.returnTone}
                        />
                      </div>
                    )}
                  </td>
                  <td className="text-muted-foreground">
                    <ChevronRight aria-hidden />
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-muted-foreground">
                  Nenhum afastamento com os filtros atuais.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selected ? (
        <Sheet
          open
          onOpenChange={(o) => {
            if (!o) setSelected(null);
          }}
        >
          <SheetContent side="right" className="w-full gap-0 overflow-hidden p-0 sm:max-w-lg">
            <div className="flex h-full min-h-0 flex-col">
              <SheetHeader className="shrink-0 space-y-0 border-b border-border bg-card px-5 pt-5 pb-4 pr-12 text-left">
                <div className="flex items-start gap-3">
                  <div
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold tracking-wide text-primary-foreground"
                    aria-hidden
                  >
                    {initialsFromName(selected.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-[15px] leading-snug font-semibold text-foreground capitalize">
                      {selected.fullName.toLocaleLowerCase("pt-BR")}
                    </SheetTitle>
                    <SheetDescription className="mt-1 text-[12px] text-muted-foreground">
                      Mat. {formatRegistrationDisplay(selected.registration)}
                      <span className="mx-1.5 text-muted-foreground">·</span>
                      {leaveTypeLabel(selected.leaveType)}
                    </SheetDescription>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <StatusBadge
                        label={humanizeLabel(selected.displayStatus)}
                        tone={toneForLeaveStatus(selected.displayStatus)}
                      />
                      <StatusBadge
                        label={leaveTypeLabel(selected.leaveType)}
                        tone={toneForLeaveType(selected.leaveType)}
                      />
                      {selected.returnLabel !== "—" ? (
                        <StatusBadge
                          label={selected.returnLabel}
                          tone={selected.returnTone}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/50 px-5 py-4">
                <DetailSection title="Identificação">
                  <DetailRow
                    label="Unidade"
                    value={formatUnitDisplayName(selected.unitName)}
                  />
                  <DetailRow
                    label="Regional"
                    value={humanizeLabel(selected.regionName)}
                  />
                </DetailSection>

                <DetailSection title="Período">
                  <DetailRow
                    label="Início"
                    value={formatDateBR(selected.startDate)}
                    mono
                  />
                  <DetailRow
                    label="Fim"
                    value={formatDateBR(selected.endDate)}
                    mono
                  />
                  <DetailRow
                    label="Dias"
                    value={selected.daysCount != null ? String(selected.daysCount) : "—"}
                    mono
                  />
                </DetailSection>

                <DetailSection title="Motivo">
                  <DetailRow
                    label="Resumo"
                    value={selected.reasonSimplified || "—"}
                  />
                  <DetailRow label="Detalhe" value={selected.reason || "—"} />
                  {canViewClinical ? (
                    <DetailRow label="CID" value={selected.cidCode || "—"} mono />
                  ) : null}
                  <DetailRow label="Observações" value={selected.notes || "—"} />
                </DetailSection>

                <DetailSection title="Retorno ao trabalho">
                  <DetailRow label="Situação" value={returnHint} />
                  <DetailRow
                    label="Último ASO (Alterdata)"
                    value={formatDateBR(selected.lastAsoDate)}
                    mono
                  />
                  <DetailRow
                    label="Retorno previsto"
                    value={formatDateBR(selected.expectedReturnDate)}
                    mono
                  />
                  <DetailRow
                    label="Retorno efetivo"
                    value={formatDateBR(selected.actualReturnDate)}
                    mono
                  />
                </DetailSection>

                {canUpdate && selected.displayStatus === "ATIVO" ? (
                  <CloseLeaveForm
                    leaveId={selected.id}
                    defaultEnd={selected.endDate}
                    onClosed={() => setSelected(null)}
                  />
                ) : null}
              </div>

              <div className="shrink-0 border-t border-border bg-card px-5 py-3.5">
                <Link
                  href={`/colaboradores/${selected.employeeId}`}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "h-8 gap-1.5 text-[12px] text-primary hover:bg-primary-soft hover:text-primary",
                  )}
                  onClick={() => {
                    startTransition(() => router.refresh());
                  }}
                >
                  Abrir prontuário
                  <ExternalLink className="size-3.5 opacity-70" />
                </Link>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </>
  );
}
