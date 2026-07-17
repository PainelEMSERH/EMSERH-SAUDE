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
    <section className="overflow-hidden rounded-lg border border-slate-200/90 bg-white">
      <div className="border-b border-slate-100 bg-slate-50/80 px-3.5 py-2">
        <h4 className="text-[11px] font-semibold tracking-[0.04em] text-slate-600 uppercase">
          {title}
        </h4>
      </div>
      <dl className="divide-y divide-slate-100">{children}</dl>
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
      <dt className="shrink-0 pt-0.5 text-[12px] text-slate-500">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-right text-[13px] leading-snug",
          empty ? "font-normal text-slate-400" : "font-medium text-slate-900",
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
            className="mt-1 h-8 w-full rounded-md border border-amber-200 bg-white px-2 text-[13px]"
          />
        </label>
        <label className="text-[11px] text-amber-900/80">
          Retorno efetivo
          <input
            type="date"
            name="actualReturnDate"
            defaultValue={today}
            className="mt-1 h-8 w-full rounded-md border border-amber-200 bg-white px-2 text-[13px]"
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
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-slate-800">Relação nominal</h3>
        <p className="text-[11px] text-slate-500">Clique na linha para ver detalhes</p>
      </div>
      <div className="rounded-lg border border-border bg-card">
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
          <thead className="sticky top-0 z-[1]">
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
                  className="cursor-pointer focus-visible:bg-teal-50/60 focus-visible:outline-none"
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
                    <p className="app-table-meta text-teal-800">
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
                    <span className="mx-1 text-slate-300">→</span>
                    {formatDateBR(r.endDate)}
                  </td>
                  <td className="app-table-num">{r.daysCount ?? "—"}</td>
                  <td className="truncate text-left text-slate-600">
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
                      <span className="text-slate-400">—</span>
                    ) : (
                      <div className="flex justify-center">
                        <StatusBadge
                          label={r.returnLabel}
                          tone={r.returnTone}
                        />
                      </div>
                    )}
                  </td>
                  <td className="text-slate-400">
                    <ChevronRight aria-hidden />
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-slate-500">
                  Nenhum afastamento com os filtros atuais.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full gap-0 overflow-hidden p-0 sm:max-w-lg">
          {selected ? (
            <div className="flex h-full min-h-0 flex-col">
              <SheetHeader className="shrink-0 space-y-0 border-b border-slate-200 bg-gradient-to-b from-teal-50/70 to-white px-5 pt-5 pb-4 pr-12 text-left">
                <div className="flex items-start gap-3">
                  <div
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-teal-800 text-[13px] font-semibold tracking-wide text-white"
                    aria-hidden
                  >
                    {initialsFromName(selected.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-[15px] leading-snug font-semibold text-slate-900 capitalize">
                      {selected.fullName.toLocaleLowerCase("pt-BR")}
                    </SheetTitle>
                    <SheetDescription className="mt-1 text-[12px] text-slate-500">
                      Mat. {formatRegistrationDisplay(selected.registration)}
                      <span className="mx-1.5 text-slate-300">·</span>
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

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/50 px-5 py-4">
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

              <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3.5">
                <Link
                  href={`/colaboradores/${selected.employeeId}`}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "h-8 gap-1.5 text-[12px] text-teal-800 hover:bg-teal-50 hover:text-teal-900",
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
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
