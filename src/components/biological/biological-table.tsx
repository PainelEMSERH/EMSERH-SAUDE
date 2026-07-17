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
import {
  completeBiologicalFollowupAction,
  concludeBiologicalAccidentAction,
} from "@/actions/occupational";
import { StatusBadge } from "@/components/feedback/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { BiologicalListRow } from "@/db/queries/occupational";
import { formatDateBR, formatDateTimeBR } from "@/lib/dates";
import {
  bioStatusLabel,
  bioStatusTone,
  followupLabel,
  followupTone,
  type BioFollowupView,
} from "@/lib/biological/constants";
import {
  formatRegistrationDisplay,
  formatUnitDisplayName,
  humanizeLabel,
  initialsFromName,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
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
}: {
  label: string;
  value: ReactNode;
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
        )}
      >
        {empty ? "—" : value}
      </dd>
    </div>
  );
}

function FollowupCell({ followups, offset }: { followups: BioFollowupView[]; offset: number }) {
  const f = followups.find((x) => x.dayOffset === offset);
  if (!f) return <span className="app-table-meta text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col items-center gap-0.5" title={`Venc. ${formatDateBR(f.dueDate)}`}>
      <StatusBadge
        label={followupLabel(f.displayStatus)}
        tone={followupTone(f.displayStatus)}
      />
      <span className="app-table-meta app-table-num text-muted-foreground">
        {formatDateBR(f.dueDate)}
      </span>
    </div>
  );
}

function CompleteFollowupForm({
  followup,
  onDone,
}: {
  followup: BioFollowupView;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    completeBiologicalFollowupAction,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      onDone?.();
      router.refresh();
    }
  }, [state, router, onDone]);

  if (followup.displayStatus === "REALIZADO") {
    return (
      <p className="text-[11px] text-primary">
        Realizado em {formatDateBR(followup.performedAt)}
      </p>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="followupId" value={followup.id} />
      <label className="text-[11px] text-muted-foreground">
        Data
        <input
          type="date"
          name="performedAt"
          defaultValue={today}
          className="mt-0.5 h-7 w-[130px] rounded-md border border-border bg-card px-2 text-[12px]"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-7 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        {pending ? "…" : "Marcar ok"}
      </button>
      {state.error ? (
        <p className="w-full text-[11px] text-red-700">{state.error}</p>
      ) : null}
    </form>
  );
}

function ConcludeForm({
  accidentId,
  onDone,
}: {
  accidentId: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    concludeBiologicalAccidentAction,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      onDone?.();
      router.refresh();
    }
  }, [state, router, onDone]);

  return (
    <form
      action={action}
      className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 dark:border-[color:var(--warning)] dark:bg-amber-500/10 p-3"
    >
      <input type="hidden" name="accidentId" value={accidentId} />
      <p className="text-[12px] font-medium text-amber-950">Concluir acompanhamento</p>
      <label className="block text-[11px] text-amber-900/80">
        Conclusão (opcional)
        <textarea
          name="conclusion"
          rows={2}
          className="mt-1 w-full resize-none rounded-md border border-amber-200 bg-card px-2 py-1.5 text-[12px]"
          placeholder="Ex.: esquema laboratorial completo, alta do acompanhamento"
        />
      </label>
      {state.error ? (
        <p className="text-[11px] text-red-700">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="h-8 rounded-md bg-amber-800 px-3 text-[12px] font-medium text-white hover:bg-amber-900 disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Concluir acidente"}
      </button>
    </form>
  );
}

function catShort(cat: string | null | undefined): string {
  const s = (cat ?? "").trim();
  if (!s) return "—";
  if (s.length <= 14) return s;
  return `…${s.slice(-10)}`;
}

export function BiologicalTable({
  rows,
  canUpdate,
}: {
  rows: BiologicalListRow[];
  canUpdate?: boolean;
}) {
  const [selected, setSelected] = useState<BiologicalListRow | null>(null);

  return (
    <>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-foreground">
          Exposições e acompanhamentos
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Clique na linha para D30/D60/D90 e detalhe
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card">
        <table className="app-data-table">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[10%]" />
            <col className="w-[16%]" />
            <col className="w-[7%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[3%]" />
          </colgroup>
          <thead>
            <tr>
              <th className="text-left">Colaborador</th>
              <th className="text-center">Data</th>
              <th className="text-left">Local</th>
              <th className="text-center">PEP</th>
              <th className="text-center">CAT</th>
              <th className="text-center">D30</th>
              <th className="text-center">D60</th>
              <th className="text-center">D90</th>
              <th className="text-center">Status</th>
              <th className="w-8" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                tabIndex={0}
                role="button"
                aria-label={`Abrir acidente de ${r.fullName}`}
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
                <td className="app-table-num">{formatDateBR(r.occurredAt)}</td>
                <td className="text-left">
                  <span
                    className="line-clamp-2 leading-snug text-foreground"
                    title={r.exposureType ?? undefined}
                  >
                    {r.exposureType?.trim() || "—"}
                  </span>
                </td>
                <td className="text-center">
                  <StatusBadge
                    label={r.pepStarted ? "Sim" : "Não"}
                    tone={r.pepStarted ? "info" : "muted"}
                  />
                </td>
                <td
                  className="app-table-num text-muted-foreground"
                  title={r.catNumber ?? undefined}
                >
                  {catShort(r.catNumber)}
                </td>
                <td className="text-center">
                  <FollowupCell followups={r.followups} offset={30} />
                </td>
                <td className="text-center">
                  <FollowupCell followups={r.followups} offset={60} />
                </td>
                <td className="text-center">
                  <FollowupCell followups={r.followups} offset={90} />
                </td>
                <td className="text-center">
                  <StatusBadge
                    label={bioStatusLabel(r.status)}
                    tone={bioStatusTone(r.status)}
                  />
                </td>
                <td className="w-8 text-right text-muted-foreground">
                  <ChevronRight className="ml-auto" aria-hidden />
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-muted-foreground">
                  Nenhum acidente com os filtros atuais.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          {selected ? (
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
                      {formatDateTimeBR(selected.occurredAt)}
                    </SheetDescription>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <StatusBadge
                        label={bioStatusLabel(selected.status)}
                        tone={bioStatusTone(selected.status)}
                      />
                      <StatusBadge
                        label={selected.pepStarted ? "PEP sim" : "PEP não"}
                        tone={selected.pepStarted ? "info" : "muted"}
                      />
                      <StatusBadge
                        label={selected.followupSummary.summaryLabel}
                        tone={selected.followupSummary.summaryTone}
                      />
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/50 px-5 py-4">
                <DetailSection title="Ocorrência">
                  <DetailRow
                    label="Unidade"
                    value={formatUnitDisplayName(selected.unitName)}
                  />
                  <DetailRow
                    label="Regional"
                    value={humanizeLabel(selected.regionName)}
                  />
                  <DetailRow
                    label="Local / tipo"
                    value={selected.exposureType}
                  />
                  <DetailRow label="Parte do corpo" value={selected.bodyPart} />
                  <DetailRow
                    label="CAT"
                    value={
                      selected.catNumber ? (
                        <span className="break-all font-mono text-[11px]">
                          {selected.catNumber}
                        </span>
                      ) : null
                    }
                  />
                  <DetailRow
                    label="PEP início"
                    value={formatDateBR(selected.pepStartDate)}
                  />
                </DetailSection>

                {selected.description ? (
                  <section className="overflow-hidden rounded-lg border border-border bg-card">
                    <div className="border-b border-border-subtle bg-muted/80 px-3.5 py-2">
                      <h4 className="text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
                        Descrição
                      </h4>
                    </div>
                    <p className="px-3.5 py-3 text-[12px] leading-relaxed whitespace-pre-wrap text-foreground/80">
                      {selected.description}
                    </p>
                  </section>
                ) : null}

                <section className="overflow-hidden rounded-lg border border-border bg-card">
                  <div className="border-b border-border-subtle bg-muted/80 px-3.5 py-2">
                    <h4 className="text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
                      Acompanhamentos
                    </h4>
                  </div>
                  <div className="divide-y divide-border-subtle">
                    {selected.followups.map((f) => (
                      <div
                        key={f.id}
                        className="flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-foreground">
                              D{f.dayOffset}
                            </span>
                            <StatusBadge
                              label={followupLabel(f.displayStatus)}
                              tone={followupTone(f.displayStatus)}
                            />
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Venc. {formatDateBR(f.dueDate)}
                          </p>
                        </div>
                        {canUpdate ? (
                          <CompleteFollowupForm
                            followup={f}
                            onDone={() => setSelected(null)}
                          />
                        ) : f.displayStatus === "REALIZADO" ? (
                          <p className="text-[11px] text-primary">
                            {formatDateBR(f.performedAt)}
                          </p>
                        ) : null}
                      </div>
                    ))}
                    {!selected.followups.length ? (
                      <p className="px-3.5 py-4 text-[12px] text-muted-foreground">
                        Sem follow-ups cadastrados.
                      </p>
                    ) : null}
                  </div>
                </section>

                {selected.conclusion ? (
                  <DetailSection title="Conclusão">
                    <DetailRow label="Registro" value={selected.conclusion} />
                  </DetailSection>
                ) : null}

                {canUpdate && selected.status === "EM_ACOMPANHAMENTO" ? (
                  <ConcludeForm
                    accidentId={selected.id}
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
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
