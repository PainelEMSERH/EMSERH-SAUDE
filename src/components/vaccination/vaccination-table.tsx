"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/feedback/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { VaccinationListRow } from "@/db/queries/occupational";
import { formatDateBR } from "@/lib/dates";
import {
  formatRegistrationDisplay,
  formatUnitDisplayName,
  humanizeLabel,
  initialsFromName,
} from "@/lib/labels";
import { situationTone } from "@/lib/vaccination/constants";
import { cn } from "@/lib/utils";

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

export function VaccinationTable({ rows }: { rows: VaccinationListRow[] }) {
  const [selected, setSelected] = useState<VaccinationListRow | null>(null);

  return (
    <>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-slate-800">Relação nominal</h3>
        <p className="text-[11px] text-slate-500">Clique na linha para ver detalhes</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed border-collapse text-left text-[11px]">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[28%]" />
              <col className="w-[12%]" />
              <col className="w-[22%]" />
              <col className="w-[9%]" />
              <col className="w-[3%]" />
            </colgroup>
            <thead className="sticky top-0 z-[1] bg-slate-50 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2.5 text-left font-semibold">Colaborador</th>
                <th className="px-3 py-2.5 text-center font-semibold">Situação</th>
                <th className="px-3 py-2.5 text-center font-semibold">Classificação</th>
                <th className="px-3 py-2.5 text-left font-semibold">Unidade</th>
                <th className="px-3 py-2.5 text-center font-semibold">Data</th>
                <th className="px-2 py-2.5" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Abrir detalhes de ${r.fullName}`}
                  className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-teal-50/40 focus-visible:bg-teal-50/60 focus-visible:outline-none"
                  onClick={() => setSelected(r)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(r);
                    }
                  }}
                >
                  <td className="px-3 py-2.5 text-left">
                    <p className="truncate font-medium text-slate-900 capitalize">
                      {r.fullName.toLocaleLowerCase("pt-BR")}
                    </p>
                    <p className="text-[11px] tabular-nums text-teal-800">
                      {formatRegistrationDisplay(r.registration)}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex justify-center">
                      <StatusBadge
                        label={r.situation}
                        tone={situationTone(r.situationKind)}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="flex justify-center">
                      <StatusBadge
                        label={
                          r.situationKind === "ok"
                            ? "Em dia"
                            : r.situationKind === "partial"
                              ? "Parcial"
                              : r.situationKind === "attention"
                                ? "Atenção"
                                : r.situationKind === "refusal"
                                  ? "Recusa"
                                  : "—"
                        }
                        tone={situationTone(r.situationKind)}
                      />
                    </div>
                  </td>
                  <td className="truncate px-3 py-2.5 text-left text-slate-600">
                    {formatUnitDisplayName(r.unitName)}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-slate-700">
                    {formatDateBR(r.administeredAt)}
                  </td>
                  <td className="px-2 py-2.5 text-slate-400">
                    <ChevronRight className="size-4" aria-hidden />
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                    Nenhuma situação vacinal com os filtros atuais.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
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
                      {selected.vaccineName}
                    </SheetDescription>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <StatusBadge
                        label={selected.situation}
                        tone={situationTone(selected.situationKind)}
                      />
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
                <DetailSection title="Vacinação">
                  <DetailRow label="Vacina" value={selected.vaccineName} />
                  <DetailRow label="Situação" value={selected.situation} />
                  <DetailRow
                    label="Data"
                    value={formatDateBR(selected.administeredAt)}
                    mono
                  />
                  <DetailRow label="Lote" value={selected.lotNumber || "—"} />
                </DetailSection>
              </div>

              <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3.5">
                <Link
                  href={`/colaboradores/${selected.employeeId}`}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "h-8 gap-1.5 text-[12px] text-teal-800 hover:bg-teal-50 hover:text-teal-900",
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
