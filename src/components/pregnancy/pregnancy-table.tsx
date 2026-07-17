"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import { updatePregnancyAction } from "@/actions/occupational";
import { StatusBadge } from "@/components/feedback/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { PregnancyListRow } from "@/db/queries/occupational";
import { formatDateBR } from "@/lib/dates";
import {
  formatRegistrationDisplay,
  formatUnitDisplayName,
  humanizeLabel,
  initialsFromName,
} from "@/lib/labels";
import {
  hazardousLabel,
  isInsalubreSemRealocacao,
  pregnancyStatusLabel,
  pregnancyStatusTone,
  PREGNANCY_STATUSES,
} from "@/lib/pregnancy/constants";
import { cn } from "@/lib/utils";

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
          empty
            ? "font-normal text-muted-foreground"
            : "font-medium text-foreground",
          mono && !empty ? "tabular-nums tracking-tight" : "",
        )}
      >
        {empty ? "—" : value}
      </dd>
    </div>
  );
}

function UpdatePregnancyForm({
  row,
  onDone,
}: {
  row: PregnancyListRow;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updatePregnancyAction, {});

  useEffect(() => {
    if (state.ok) {
      onDone?.();
      router.refresh();
    }
  }, [state, router, onDone]);

  return (
    <form
      action={action}
      className="space-y-2.5 rounded-lg border border-border bg-card p-3"
    >
      <input type="hidden" name="pregnancyId" value={row.id} />
      <p className="text-[12px] font-semibold text-foreground">
        Atualizar acompanhamento
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-[11px] text-muted-foreground">
          Status
          <select
            name="status"
            defaultValue={row.status}
            className="mt-0.5 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]"
          >
            {PREGNANCY_STATUSES.filter((s) => s.value !== "ALL").map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[11px] text-muted-foreground">
          Data realocação
          <input
            type="date"
            name="relocationDate"
            defaultValue={row.relocationDate ?? undefined}
            className="mt-0.5 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]"
          />
        </label>
        <label className="block text-[11px] text-muted-foreground sm:col-span-2">
          Setor destino
          <input
            name="destinationSector"
            defaultValue={row.destinationSector ?? ""}
            className="mt-0.5 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]"
          />
        </label>
        <label className="block text-[11px] text-muted-foreground">
          Início licença
          <input
            type="date"
            name="leaveStartDate"
            defaultValue={row.leaveStartDate ?? undefined}
            className="mt-0.5 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]"
          />
        </label>
        <label className="block text-[11px] text-muted-foreground">
          Retorno
          <input
            type="date"
            name="returnDate"
            defaultValue={row.returnDate ?? undefined}
            className="mt-0.5 h-8 w-full rounded-md border border-border bg-card px-2 text-[12px]"
          />
        </label>
        <label className="block text-[11px] text-muted-foreground sm:col-span-2">
          Observações
          <textarea
            name="notes"
            rows={2}
            defaultValue={row.notes ?? ""}
            className="mt-0.5 w-full resize-none rounded-md border border-border bg-card px-2 py-1.5 text-[12px]"
          />
        </label>
      </div>
      {state.error ? (
        <p className="text-[11px] text-red-700">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-8 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Salvar alterações"}
      </button>
    </form>
  );
}

function sectorFlow(origin: string | null, dest: string | null): string {
  const a = (origin ?? "").trim() || "—";
  const b = (dest ?? "").trim() || "—";
  if (a === "—" && b === "—") return "—";
  return `${a} → ${b}`;
}

export function PregnancyTable({
  rows,
  canUpdate,
}: {
  rows: PregnancyListRow[];
  canUpdate?: boolean;
}) {
  const [selected, setSelected] = useState<PregnancyListRow | null>(null);

  return (
    <>
      <div className="app-section-title">
        <h3>Relação de gestantes</h3>
        <p>Clique na linha para ver detalhe e atualizar</p>
      </div>
      <div className="app-surface">
        <table className="app-data-table">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[14%]" />
            <col className="w-[11%]" />
            <col className="w-[13%]" />
            <col className="w-[18%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
            <col className="w-[3%]" />
          </colgroup>
          <thead>
            <tr>
              <th className="text-left">Colaboradora</th>
              <th className="text-left">Unidade</th>
              <th className="text-center">Comunicação</th>
              <th className="text-center">Insalubridade</th>
              <th className="text-left">Setores</th>
              <th className="text-center">Prev. parto</th>
              <th className="text-center">Status</th>
              <th className="w-8" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const haz = hazardousLabel(r);
              const alert = isInsalubreSemRealocacao(r);
              return (
                <tr
                  key={r.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Abrir caso de ${r.fullName}`}
                  className={cn(
                    "cursor-pointer focus-visible:bg-primary-soft focus-visible:outline-none",
                    alert ? "bg-red-50/40" : "",
                  )}
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
                  <td className="text-left">
                    <span className="line-clamp-2 leading-snug">
                      {formatUnitDisplayName(r.unitName)}
                    </span>
                  </td>
                  <td className="app-table-num">
                    {formatDateBR(r.communicationDate)}
                  </td>
                  <td className="text-center">
                    <StatusBadge label={haz.label} tone={haz.tone} />
                  </td>
                  <td className="text-left">
                    <span
                      className="line-clamp-2 leading-snug text-foreground"
                      title={sectorFlow(r.originSector, r.destinationSector)}
                    >
                      {sectorFlow(r.originSector, r.destinationSector)}
                    </span>
                  </td>
                  <td className="app-table-num">
                    {formatDateBR(r.dueDate)}
                  </td>
                  <td className="text-center">
                    <StatusBadge
                      label={pregnancyStatusLabel(r.status)}
                      tone={pregnancyStatusTone(r.status)}
                    />
                  </td>
                  <td className="w-8 text-right text-muted-foreground">
                    <ChevronRight className="ml-auto" aria-hidden />
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-10 text-center text-muted-foreground"
                >
                  Nenhuma gestante com os filtros atuais.
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
          <SheetContent
            side="right"
            className="w-full gap-0 overflow-hidden p-0 sm:max-w-lg"
          >
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
                      {formatUnitDisplayName(selected.unitName)}
                    </SheetDescription>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <StatusBadge
                        label={pregnancyStatusLabel(selected.status)}
                        tone={pregnancyStatusTone(selected.status)}
                      />
                      <StatusBadge
                        label={hazardousLabel(selected).label}
                        tone={hazardousLabel(selected).tone}
                      />
                      {isInsalubreSemRealocacao(selected) ? (
                        <StatusBadge label="Alerta realocação" tone="danger" />
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

                <DetailSection title="Gestação">
                  <DetailRow
                    label="Comunicação"
                    value={formatDateBR(selected.communicationDate)}
                    mono
                  />
                  <DetailRow
                    label="Comprovação"
                    value={selected.proofType}
                  />
                  <DetailRow
                    label="Previsão de parto"
                    value={formatDateBR(selected.dueDate)}
                    mono
                  />
                  <DetailRow
                    label="Início licença"
                    value={formatDateBR(selected.leaveStartDate)}
                    mono
                  />
                  <DetailRow
                    label="Retorno"
                    value={formatDateBR(selected.returnDate)}
                    mono
                  />
                </DetailSection>

                <DetailSection title="Insalubridade e realocação">
                  <DetailRow
                    label="Insalubre"
                    value={
                      <StatusBadge
                        label={hazardousLabel(selected).label}
                        tone={hazardousLabel(selected).tone}
                      />
                    }
                  />
                  <DetailRow
                    label="Setor origem"
                    value={selected.originSector}
                  />
                  <DetailRow
                    label="Setor destino"
                    value={selected.destinationSector}
                  />
                  <DetailRow
                    label="Data realocação"
                    value={formatDateBR(selected.relocationDate)}
                    mono
                  />
                </DetailSection>

                {selected.notes ? (
                  <DetailSection title="Observações">
                    <div className="px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground">
                      {selected.notes}
                    </div>
                  </DetailSection>
                ) : null}

                {canUpdate ? (
                  <UpdatePregnancyForm
                    row={selected}
                    onDone={() => setSelected(null)}
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
