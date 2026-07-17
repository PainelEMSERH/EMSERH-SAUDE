"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Eye } from "lucide-react";
import { AsoJustifyDialog } from "@/components/aso/aso-justify-dialog";
import { AsoReprogramDialog } from "@/components/aso/aso-reprogram-dialog";
import { StatusBadge } from "@/components/feedback/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { registerAsoRealizationAction } from "@/actions/aso-panel";
import {
  canRegisterRealization,
  effectiveExecutionStatus,
} from "@/lib/aso/execution";
import { formatDateBR } from "@/lib/dates";
import {
  formatRegistrationDisplay,
  humanizeLabel,
  toneForFunctionalStatus,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import { buildAsoUrl } from "@/lib/aso/planning";

export type AsoNominalRow = {
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
  asoRecordId?: string | null;
  predictionOrigin?: string | null;
};

function toneForExecution(status: string): "ok" | "warn" | "danger" | "muted" | "info" {
  switch (status) {
    case "REALIZADO":
      return "ok";
    case "VENCIDO":
      return "danger";
    case "AGENDADO":
    case "REPROGRAMADO":
      return "warn";
    case "JUSTIFICADO":
    case "DISPENSADO":
      return "muted";
    default:
      return "info";
  }
}

function toneForAlterdata(status: string): "ok" | "warn" | "danger" | "muted" | "info" {
  switch (status) {
    case "CONFIRMADO":
      return "ok";
    case "PENDENTE_ATUALIZACAO":
    case "AGUARDANDO_SINCRONIZACAO":
      return "warn";
    case "DIVERGENCIA_DATA":
      return "danger";
    default:
      return "muted";
  }
}

function shortAlterdata(status: string): string {
  switch (status) {
    case "AGUARDANDO_SINCRONIZACAO":
      return "Aguardando";
    case "PENDENTE_ATUALIZACAO":
      return "Pendente";
    case "DIVERGENCIA_DATA":
      return "Divergência";
    case "ATUALIZADO_SEM_REGISTRO":
      return "Sem registro";
    case "SEM_HISTORICO":
      return "Sem histórico";
    case "CONFIRMADO":
      return "Confirmado";
    default:
      return humanizeLabel(status);
  }
}

function pendencyLabel(r: AsoNominalRow, effective: string): string {
  if (r.justificationReason) return humanizeLabel(r.justificationReason);
  if (effective === "VENCIDO") return "Vencido";
  if (
    r.alterdataStatus === "PENDENTE_ATUALIZACAO" ||
    r.alterdataStatus === "AGUARDANDO_SINCRONIZACAO"
  ) {
    return "Pendente Alterdata";
  }
  if (r.alterdataStatus === "DIVERGENCIA_DATA") return "Divergência";
  return "—";
}

export function AsoNominalFilters({
  current,
  params,
}: {
  current: Record<string, string | number | undefined>;
  params: {
    execution?: string;
    alterdata?: string;
    functional?: string;
    pendingOnly?: string;
    divergencesOnly?: string;
  };
}) {
  const active: Array<{ key: string; label: string }> = [];
  if (params.functional && params.functional !== "ALL") {
    active.push({ key: "functional", label: `Funcional: ${humanizeLabel(params.functional)}` });
  }
  if (params.execution && params.execution !== "ALL") {
    active.push({ key: "execution", label: `Execução: ${humanizeLabel(params.execution)}` });
  }
  if (params.alterdata && params.alterdata !== "ALL") {
    active.push({ key: "alterdata", label: `Alterdata: ${humanizeLabel(params.alterdata)}` });
  }
  if (params.pendingOnly === "1") {
    active.push({ key: "pendingOnly", label: "Somente pendentes" });
  }
  if (params.divergencesOnly === "1") {
    active.push({ key: "divergencesOnly", label: "Somente divergências" });
  }

  const clearHref = buildAsoUrl("/asos", current, {
    execution: undefined,
    alterdata: undefined,
    functional: undefined,
    pendingOnly: undefined,
    divergencesOnly: undefined,
    priority: undefined,
    page: undefined,
  });

  return (
    <div className="mb-2 rounded-lg border border-slate-200 bg-white p-2.5">
      <form className="flex flex-wrap items-end gap-2" method="get">
        {Object.entries(current).map(([k, v]) => {
          if (
            v == null ||
            ["execution", "alterdata", "functional", "pendingOnly", "divergencesOnly", "page", "priority"].includes(k)
          ) {
            return null;
          }
          return <input key={k} type="hidden" name={k} value={String(v)} />;
        })}
        <label className="text-[11px] font-medium text-slate-600">
          Situação funcional
          <select
            name="functional"
            defaultValue={params.functional || "ALL"}
            className="mt-0.5 block h-8 min-w-[140px] rounded-md border border-slate-200 px-2 text-[12px]"
          >
            <option value="ALL">Todas</option>
            <option value="ATIVO">Ativo</option>
            <option value="AFASTADO">Afastado</option>
            <option value="FERIAS">Férias</option>
            <option value="DEMITIDO">Demitido</option>
          </select>
        </label>
        <label className="text-[11px] font-medium text-slate-600">
          Execução
          <select
            name="execution"
            defaultValue={params.execution || "ALL"}
            className="mt-0.5 block h-8 min-w-[140px] rounded-md border border-slate-200 px-2 text-[12px]"
          >
            <option value="ALL">Todas</option>
            <option value="PREVISTO">Previsto</option>
            <option value="AGENDADO">Agendado</option>
            <option value="REALIZADO">Realizado</option>
            <option value="VENCIDO">Vencido</option>
            <option value="JUSTIFICADO">Justificado</option>
            <option value="REPROGRAMADO">Reprogramado</option>
          </select>
        </label>
        <label className="text-[11px] font-medium text-slate-600">
          Alterdata
          <select
            name="alterdata"
            defaultValue={params.alterdata || "ALL"}
            className="mt-0.5 block h-8 min-w-[160px] rounded-md border border-slate-200 px-2 text-[12px]"
          >
            <option value="ALL">Todas</option>
            <option value="CONFIRMADO">Confirmado</option>
            <option value="AGUARDANDO_SINCRONIZACAO">Aguardando sincronização</option>
            <option value="PENDENTE_ATUALIZACAO">Pendente</option>
            <option value="DIVERGENCIA_DATA">Divergência</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 pb-1.5 text-[12px] text-slate-700">
          <input
            type="checkbox"
            name="pendingOnly"
            value="1"
            defaultChecked={params.pendingOnly === "1"}
          />
          Somente pendentes
        </label>
        <label className="flex items-center gap-1.5 pb-1.5 text-[12px] text-slate-700">
          <input
            type="checkbox"
            name="divergencesOnly"
            value="1"
            defaultChecked={params.divergencesOnly === "1"}
          />
          Somente divergências
        </label>
        <button
          type="submit"
          className="h-8 rounded-md bg-teal-700 px-3 text-[12px] font-medium text-white hover:bg-teal-800"
        >
          Filtrar
        </button>
      </form>
      {active.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {active.map((a) => (
            <span
              key={a.key}
              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
            >
              {a.label}
            </span>
          ))}
          <Link href={clearHref} className="text-[11px] font-medium text-teal-800 hover:underline">
            Limpar filtros nominais
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function AsoNominalTable({
  rows,
  canCreate,
  canUpdate,
}: {
  rows: AsoNominalRow[];
  canCreate?: boolean;
  canUpdate?: boolean;
}) {
  const [selected, setSelected] = useState<AsoNominalRow | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const selectedEffective = useMemo(
    () =>
      selected
        ? String(
            effectiveExecutionStatus({
              eligibility: selected.eligibility,
              executionStatus: selected.executionStatus,
              expectedDate: selected.expectedDate,
              asoRecordId: selected.asoRecordId,
              performedDate: selected.performedDate,
            }),
          )
        : "",
    [selected],
  );

  return (
    <>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-slate-800">Relação nominal</h3>
        <p className="text-[11px] text-slate-500">Clique na linha para ver detalhes</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full table-fixed border-collapse text-[12px]">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[7%]" />
            <col className="w-[16%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
            <col className="w-[7%]" />
          </colgroup>
          <thead className="sticky top-0 z-20 bg-slate-50 shadow-[0_1px_0_0_rgb(226_232_240)]">
            <tr>
              {[
                "Colaborador",
                "Matrícula",
                "Unidade",
                "Tipo",
                "Previsto",
                "Sit. funcional",
                "Execução",
                "Alterdata",
                "Pendência",
                "Ações",
              ].map((h) => (
                <th
                  key={h}
                  className="border-b border-slate-200 bg-slate-50 px-2 py-2 text-center font-semibold tracking-wide text-slate-500 uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const effective = String(
                effectiveExecutionStatus({
                  eligibility: r.eligibility,
                  executionStatus: r.executionStatus,
                  expectedDate: r.expectedDate,
                  asoRecordId: r.asoRecordId,
                  performedDate: r.performedDate,
                }),
              );
              const canRegister =
                canCreate &&
                canRegisterRealization({
                  eligibility: r.eligibility,
                  executionStatus: r.executionStatus,
                  expectedDate: r.expectedDate,
                  asoRecordId: r.asoRecordId,
                  performedDate: r.performedDate,
                });
              return (
                <tr
                  key={r.id}
                  className="cursor-pointer border-b border-slate-100 hover:bg-teal-50/40"
                  onClick={() => setSelected(r)}
                >
                  <td className="px-2 py-1.5 text-left font-medium text-slate-900">
                    <span className="block truncate" title={r.employeeName}>
                      {r.employeeName}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <Link
                      href={`/colaboradores/${r.employeeId}`}
                      className="font-semibold text-teal-800 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {formatRegistrationDisplay(r.registration)}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 text-left">
                    <span
                      className="block truncate text-slate-600"
                      title={r.unitNameSnapshot ?? undefined}
                    >
                      {humanizeLabel(r.unitNameSnapshot)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center">{humanizeLabel(r.asoType)}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">
                    {formatDateBR(r.expectedDate)}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <StatusBadge
                      label={humanizeLabel(r.functionalStatusSnapshot)}
                      tone={toneForFunctionalStatus(r.functionalStatusSnapshot)}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <StatusBadge
                      label={humanizeLabel(effective)}
                      tone={toneForExecution(effective)}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span title={humanizeLabel(r.alterdataStatus)}>
                      <StatusBadge
                        label={shortAlterdata(r.alterdataStatus)}
                        tone={toneForAlterdata(r.alterdataStatus)}
                      />
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center text-slate-600">
                    <span className="block truncate" title={pendencyLabel(r, effective)}>
                      {pendencyLabel(r, effective)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap justify-center gap-1">
                      <button
                        type="button"
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "h-6 px-1.5 text-[10px]",
                        )}
                        onClick={() => setSelected(r)}
                        title="Ver detalhes"
                      >
                        <Eye className="size-3" />
                      </button>
                      {canRegister ? (
                        <button
                          type="button"
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "h-6 px-1.5 text-[10px]",
                          )}
                          onClick={() => {
                            setSelected(r);
                            setRegisterOpen(true);
                            setError(null);
                          }}
                        >
                          Registrar
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                  Nenhum colaborador nesta competência com os filtros atuais.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.employeeName}</SheetTitle>
                <SheetDescription>
                  Mat. {formatRegistrationDisplay(selected.registration)} ·{" "}
                  {humanizeLabel(selected.asoType)}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6">
                <section>
                  <h4 className="mb-1.5 text-[10px] font-semibold tracking-wide text-teal-800 uppercase">
                    Identificação
                  </h4>
                  <dl className="grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <dt className="text-slate-500">Unidade</dt>
                      <dd className="font-medium">{humanizeLabel(selected.unitNameSnapshot)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Regional</dt>
                      <dd className="font-medium">{humanizeLabel(selected.regionNameSnapshot)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Situação funcional</dt>
                      <dd className="font-medium">
                        {humanizeLabel(selected.functionalStatusSnapshot)}
                      </dd>
                    </div>
                  </dl>
                </section>
                <section>
                  <h4 className="mb-1.5 text-[10px] font-semibold tracking-wide text-teal-800 uppercase">
                    Planejamento
                  </h4>
                  <dl className="grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <dt className="text-slate-500">Competência</dt>
                      <dd className="font-medium">
                        {String(selected.month).padStart(2, "0")}/{selected.year}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Data prevista</dt>
                      <dd className="font-medium">{formatDateBR(selected.expectedDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Origem</dt>
                      <dd className="font-medium">
                        {humanizeLabel(selected.predictionOrigin)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Elegibilidade</dt>
                      <dd className="font-medium">{humanizeLabel(selected.eligibility)}</dd>
                    </div>
                  </dl>
                </section>
                <section>
                  <h4 className="mb-1.5 text-[10px] font-semibold tracking-wide text-teal-800 uppercase">
                    Realização
                  </h4>
                  <dl className="grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <dt className="text-slate-500">Execução</dt>
                      <dd className="font-medium">{humanizeLabel(selectedEffective)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Data realizada</dt>
                      <dd className="font-medium">{formatDateBR(selected.performedDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Resultado</dt>
                      <dd className="font-medium">{humanizeLabel(selected.result)}</dd>
                    </div>
                  </dl>
                </section>
                <section>
                  <h4 className="mb-1.5 text-[10px] font-semibold tracking-wide text-teal-800 uppercase">
                    Alterdata
                  </h4>
                  <dl className="grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <dt className="text-slate-500">Conciliação</dt>
                      <dd className="font-medium">{humanizeLabel(selected.alterdataStatus)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Próximo ASO</dt>
                      <dd className="font-medium">{formatDateBR(selected.nextAsoDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Pendência</dt>
                      <dd className="font-medium">
                        {pendencyLabel(selected, selectedEffective)}
                      </dd>
                    </div>
                  </dl>
                </section>
                <section className="space-y-2 border-t border-slate-100 pt-3">
                  <h4 className="text-[10px] font-semibold tracking-wide text-teal-800 uppercase">
                    Ações
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {canCreate &&
                    canRegisterRealization({
                      eligibility: selected.eligibility,
                      executionStatus: selected.executionStatus,
                      expectedDate: selected.expectedDate,
                      asoRecordId: selected.asoRecordId,
                      performedDate: selected.performedDate,
                    }) ? (
                      <button
                        type="button"
                        className={cn(
                          buttonVariants({ variant: "default", size: "sm" }),
                          "h-8 bg-teal-700 text-[12px] hover:bg-teal-800",
                        )}
                        onClick={() => {
                          setRegisterOpen(true);
                          setError(null);
                        }}
                      >
                        Registrar realização
                      </button>
                    ) : null}
                    {selected.executionStatus === "REALIZADO" || selected.asoRecordId ? (
                      <button
                        type="button"
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "h-8 text-[12px]",
                        )}
                        onClick={() => {
                          setRegisterOpen(true);
                          setError(null);
                        }}
                      >
                        Ver realização
                      </button>
                    ) : null}
                    {canUpdate &&
                    selected.executionStatus !== "REALIZADO" &&
                    !selected.asoRecordId ? (
                      <>
                        <AsoJustifyDialog
                          plan={{
                            id: selected.id,
                            registration: selected.registration,
                            employeeName: selected.employeeName,
                            asoType: selected.asoType,
                          }}
                        />
                        <AsoReprogramDialog
                          plan={{
                            id: selected.id,
                            registration: selected.registration,
                            employeeName: selected.employeeName,
                            asoType: selected.asoType,
                            expectedDate: selected.expectedDate,
                            year: selected.year,
                            month: selected.month,
                          }}
                        />
                      </>
                    ) : null}
                    <Link
                      href={`/colaboradores/${selected.employeeId}`}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                        "h-8 text-[12px]",
                      )}
                    >
                      Abrir prontuário
                    </Link>
                  </div>
                </section>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {registerOpen && selected ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-sm font-semibold text-slate-900">
              {selected.asoRecordId || selected.executionStatus === "REALIZADO"
                ? "Realização / correção"
                : "Registrar realização"}
            </h3>
            <p className="mt-1 text-[12px] text-slate-500">
              {selected.employeeName} · Mat.{" "}
              {formatRegistrationDisplay(selected.registration)} ·{" "}
              {humanizeLabel(selected.asoType)} ·{" "}
              {humanizeLabel(selected.unitNameSnapshot)} ·{" "}
              {String(selected.month).padStart(2, "0")}/{selected.year} · Previsto{" "}
              {formatDateBR(selected.expectedDate)}
            </p>
            <form
              className="mt-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                setError(null);
                startTransition(async () => {
                  const result = await registerAsoRealizationAction({}, fd);
                  if (result.error) {
                    setError(result.error);
                    return;
                  }
                  setRegisterOpen(false);
                  setSelected(null);
                  router.refresh();
                });
              }}
            >
              <input type="hidden" name="planId" value={selected.id} />
              <label className="block text-[11px] font-medium text-slate-600">
                Data realizada *
                <input
                  required
                  type="date"
                  name="performedDate"
                  defaultValue={selected.performedDate ?? undefined}
                  className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-[13px]"
                />
              </label>
              <label className="block text-[11px] font-medium text-slate-600">
                Resultado
                <select
                  name="result"
                  defaultValue={selected.result ?? ""}
                  className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-[13px]"
                >
                  <option value="">—</option>
                  <option value="APTO">Apto</option>
                  <option value="INAPTO">Inapto</option>
                  <option value="APTO_COM_RESTRICAO">Apto com restrição</option>
                </select>
              </label>
              {selected.asoType === "PERIODICO" ? (
                <label className="block text-[11px] font-medium text-slate-600">
                  Periodicidade (meses)
                  <input
                    type="number"
                    name="periodicityMonths"
                    defaultValue={12}
                    className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-[13px]"
                  />
                </label>
              ) : null}
              {(selected.asoRecordId || selected.executionStatus === "REALIZADO") &&
              canUpdate ? (
                <label className="block text-[11px] font-medium text-slate-600">
                  Motivo da correção *
                  <input
                    required
                    name="correctionReason"
                    className="mt-1 h-8 w-full rounded-md border border-slate-200 px-2 text-[13px]"
                    placeholder="Obrigatório para alterar realização existente"
                  />
                </label>
              ) : null}
              <label className="block text-[11px] font-medium text-slate-600">
                Observação administrativa
                <textarea
                  name="adminNotes"
                  rows={2}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-[13px]"
                />
              </label>
              {error ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                  {error}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setRegisterOpen(false)}
                  className="h-8 rounded-md border border-slate-200 px-3 text-[13px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="h-8 rounded-md bg-teal-700 px-3 text-[13px] text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  {pending ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
