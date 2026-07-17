"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { StatusBadge } from "@/components/feedback/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  justifyAsoPlanAction,
  registerAsoRealizationAction,
} from "@/actions/aso-panel";
import { formatDateBR } from "@/lib/dates";
import {
  formatRegistrationDisplay,
  humanizeLabel,
  toneForFunctionalStatus,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  employeeId: string;
  registration: string;
  employeeName: string;
  asoType: string;
  year: number;
  month: number;
  expectedDate: string | null;
  regionNameSnapshot: string | null;
  unitNameSnapshot: string | null;
  functionalStatusSnapshot: string | null;
  eligibility: string;
  executionStatus: string;
  alterdataStatus: string;
  performedDate: string | null;
  result: string | null;
  nextAsoDate: string | null;
  justificationReason: string | null;
};

export function AsoNominalTable({ rows }: { rows: Row[] }) {
  const [selected, setSelected] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  return (
    <>
      <div className="max-h-[480px] overflow-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[1400px] border-collapse text-[11px]">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              {[
                "Colaborador",
                "Matrícula",
                "Unidade",
                "Regional",
                "Tipo",
                "Previsto",
                "Competência",
                "Sit. funcional",
                "Execução",
                "Realizado",
                "Resultado",
                "Alterdata",
                "Próx. ASO",
                "Pendência",
                "Ações",
              ].map((h) => (
                <th
                  key={h}
                  className="border-b border-slate-200 px-2 py-2 text-left font-semibold tracking-wide text-slate-500 uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-teal-50/40">
                <td className="px-2 py-1.5 font-medium text-slate-900">{r.employeeName}</td>
                <td className="px-2 py-1.5">
                  <Link
                    href={`/colaboradores/${r.employeeId}`}
                    className="font-semibold text-teal-800 hover:underline"
                  >
                    {formatRegistrationDisplay(r.registration)}
                  </Link>
                </td>
                <td className="max-w-[140px] truncate px-2 py-1.5" title={r.unitNameSnapshot ?? undefined}>
                  {humanizeLabel(r.unitNameSnapshot)}
                </td>
                <td className="px-2 py-1.5">{humanizeLabel(r.regionNameSnapshot)}</td>
                <td className="px-2 py-1.5">{humanizeLabel(r.asoType)}</td>
                <td className="px-2 py-1.5 tabular-nums">{formatDateBR(r.expectedDate)}</td>
                <td className="px-2 py-1.5 tabular-nums">
                  {String(r.month).padStart(2, "0")}/{r.year}
                </td>
                <td className="px-2 py-1.5">
                  <StatusBadge
                    label={humanizeLabel(r.functionalStatusSnapshot)}
                    tone={toneForFunctionalStatus(r.functionalStatusSnapshot)}
                  />
                </td>
                <td className="px-2 py-1.5">{humanizeLabel(r.executionStatus)}</td>
                <td className="px-2 py-1.5 tabular-nums">{formatDateBR(r.performedDate)}</td>
                <td className="px-2 py-1.5">{humanizeLabel(r.result)}</td>
                <td className="px-2 py-1.5">{humanizeLabel(r.alterdataStatus)}</td>
                <td className="px-2 py-1.5 tabular-nums">{formatDateBR(r.nextAsoDate)}</td>
                <td className="px-2 py-1.5 text-slate-600">
                  {r.justificationReason
                    ? humanizeLabel(r.justificationReason)
                    : r.executionStatus === "VENCIDO"
                      ? "Vencido"
                      : "—"}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "h-6 px-1.5 text-[10px]",
                      )}
                      onClick={() => {
                        setSelected(r);
                        setOpen(true);
                      }}
                    >
                      Registrar
                    </button>
                    <form
                      action={(fd) => {
                        startTransition(async () => {
                          await justifyAsoPlanAction({}, fd);
                          router.refresh();
                        });
                      }}
                    >
                      <input type="hidden" name="planId" value={r.id} />
                      <input type="hidden" name="reason" value="AFASTADO" />
                      <input type="hidden" name="notes" value="Justificativa pela relação nominal" />
                      <button
                        type="submit"
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "h-6 px-1.5 text-[10px]",
                        )}
                      >
                        Justificar
                      </button>
                    </form>
                    <Link
                      href={`/colaboradores/${r.employeeId}`}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                        "h-6 px-1.5 text-[10px]",
                      )}
                    >
                      Prontuário
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={15} className="px-3 py-8 text-center text-slate-500">
                  Nenhum colaborador nesta competência com os filtros atuais.
                  Gere o planejamento ou sincronize o Alterdata.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {open && selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-sm font-semibold text-slate-900">Registrar realização</h3>
            <p className="mt-1 text-[12px] text-slate-500">
              {selected.employeeName} · Mat. {selected.registration}
            </p>
            <form
              className="mt-3 space-y-2"
              action={async (fd) => {
                await registerAsoRealizationAction({}, fd);
                setOpen(false);
                router.refresh();
              }}
            >
              <input type="hidden" name="planId" value={selected.id} />
              <p className="text-[12px] text-slate-600">
                Tipo: <strong>{humanizeLabel(selected.asoType)}</strong> · Prevista:{" "}
                <strong>{formatDateBR(selected.expectedDate)}</strong>
              </p>
              <label className="block text-[11px] font-medium text-slate-600">
                Data realizada *
                <input
                  required
                  type="date"
                  name="performedDate"
                  className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-[13px]"
                />
              </label>
              <label className="block text-[11px] font-medium text-slate-600">
                Resultado
                <select
                  name="result"
                  className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-[13px]"
                >
                  <option value="">—</option>
                  <option value="APTO">Apto</option>
                  <option value="INAPTO">Inapto</option>
                  <option value="APTO_COM_RESTRICAO">Apto com restrição</option>
                </select>
              </label>
              <label className="block text-[11px] font-medium text-slate-600">
                Periodicidade (meses)
                <input
                  type="number"
                  name="periodicityMonths"
                  defaultValue={12}
                  className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-[13px]"
                />
              </label>
              <label className="block text-[11px] font-medium text-slate-600">
                Observação
                <textarea
                  name="adminNotes"
                  rows={2}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-[13px]"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-8 rounded-md border border-slate-200 px-3 text-[13px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-8 rounded-md bg-teal-700 px-3 text-[13px] text-white hover:bg-teal-800"
                >
                  Salvar realização
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
