import Link from "next/link";
import {
  AlertTriangle,
  Baby,
  ClipboardCheck,
  HeartPulse,
  LayoutDashboard,
  RefreshCw,
  ShieldAlert,
  Syringe,
  Users,
} from "lucide-react";
import { DashboardEvolutionChart } from "@/components/dashboard/evolution-chart";
import { DashboardFiltersBar } from "@/components/dashboard/filters-bar";
import {
  DashKpi,
  DashPanel,
  DashRow,
  DashStat,
} from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/feedback/status-badge";
import { buttonVariants } from "@/components/ui/button";
import type { DashboardBundle } from "@/db/queries/dashboard-bundle";
import { buildDashboardUrl } from "@/lib/dashboard/params";
import { formatAdherencePercent } from "@/lib/aso/format-percent";
import { formatDateTimeBR } from "@/lib/dates";
import {
  humanizeImportBatchStatus,
  isSyncPossiblyStale,
} from "@/lib/aso/execution";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types";

type Ready = Extract<DashboardBundle, { configured: true }>;

export function DashboardView({
  data,
  user,
}: {
  data: Ready;
  user: SessionUser;
}) {
  const hideRegion = user.scopeLevel === "UNIT";
  const lockRegion = user.scopeLevel === "REGION";
  const lockUnit = user.scopeLevel === "UNIT";
  const aso = data.aso;

  const compareRows =
    data.filters.regionId && !data.filters.unitId
      ? data.unitCompare
      : data.regionalCompare;

  const compareTitle =
    data.filters.regionId && !data.filters.unitId
      ? "Desempenho por unidade"
      : "Desempenho por regional";

  const asoTone =
    aso?.aderenciaPercent == null
      ? "default"
      : aso.metaDefined &&
          aso.metaPercent != null &&
          aso.aderenciaPercent < aso.metaPercent - 10
        ? "danger"
        : aso.metaDefined &&
            aso.metaPercent != null &&
            aso.aderenciaPercent < aso.metaPercent
          ? "warn"
          : "ok";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
            <LayoutDashboard className="size-5" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-[1.375rem] font-semibold tracking-tight text-slate-900">
              Dashboard
            </h2>
            <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">
              Visão operacional da saúde ocupacional no escopo selecionado.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-md border border-border bg-white px-2.5 py-1 text-[12px] font-medium text-slate-700 shadow-sm">
                {data.contextLabel}
              </span>
              <span className="text-[11px] text-slate-400">
                Atualizado {formatDateTimeBR(data.generatedAt)}
              </span>
            </div>
          </div>
        </div>
        {data.canExport ? (
          <Link
            href={`/api/dashboard/export?${new URLSearchParams({
              year: String(data.filters.year),
              month: String(data.filters.month),
              ...(data.filters.regionId
                ? { regionId: data.filters.regionId }
                : {}),
              ...(data.filters.unitId ? { unitId: data.filters.unitId } : {}),
            }).toString()}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-9 text-[12.5px]",
            )}
          >
            Exportar resumo
          </Link>
        ) : null}
      </div>

      <DashboardFiltersBar
        years={data.years}
        regions={data.regions}
        units={data.units}
        current={{
          year: data.filters.year,
          month: data.filters.month,
          regionId: data.filters.regionId || undefined,
          unitId: data.filters.unitId || undefined,
        }}
        hideRegion={hideRegion}
        lockRegion={lockRegion}
        lockUnit={lockUnit}
      />

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashKpi
          label="Colaboradores"
          value={String(data.headcount.total)}
          hint={`${data.headcount.ativos} ativos · ${data.headcount.afastados} afastados · ${data.headcount.ferias} férias`}
          href="/colaboradores"
          icon={Users}
        />
        <DashKpi
          label="Aderência ASO"
          value={aso?.aderenciaLabel ?? "—"}
          hint={
            aso
              ? `${aso.realizados}/${aso.previstosElegiveis} elegíveis${
                  aso.metaDefined && aso.metaPercent != null
                    ? ` · meta ${aso.metaPercent}%`
                    : ""
                }`
              : "Sem planejamento nesta competência"
          }
          href={aso?.href}
          icon={ClipboardCheck}
          tone={asoTone}
        />
        <DashKpi
          label="Afastamentos ativos"
          value={String(data.leave.ativos)}
          hint={
            data.leave.asoRetornoPendentes > 0
              ? `${data.leave.asoRetornoPendentes} com ASO de retorno pendente`
              : `${data.leave.retornos7d} retornos nos próximos 7 dias`
          }
          href="/afastamentos?status=ATIVO"
          icon={HeartPulse}
          tone={data.leave.asoRetornoPendentes > 0 ? "warn" : "default"}
        />
        <DashKpi
          label="Pendências críticas"
          value={String(data.critical)}
          hint="Vencidos, Alterdata pendente, retornos atrasados e cadastro sem regional"
          href={aso?.href}
          icon={AlertTriangle}
          tone={data.critical > 0 ? "danger" : "ok"}
        />
      </div>

      {/* Prioridades */}
      {data.priorities.length ? (
        <DashPanel
          title="Prioridades"
          description="O que precisa de atenção agora no filtro atual."
        >
          <ul className="grid gap-2 md:grid-cols-2">
            {data.priorities.map((p) => (
              <li key={p.id}>
                <Link
                  href={p.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors",
                    p.tone === "danger"
                      ? "border-red-100 bg-red-50/50 hover:bg-red-50"
                      : p.tone === "warn"
                        ? "border-amber-100 bg-amber-50/40 hover:bg-amber-50"
                        : "border-border-subtle bg-slate-50/70 hover:bg-emerald-50/60",
                  )}
                >
                  <StatusBadge
                    label={String(p.count)}
                    tone={
                      p.tone === "danger"
                        ? "danger"
                        : p.tone === "warn"
                          ? "warn"
                          : "info"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-900">
                      {p.title}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-slate-500">
                      {p.description}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] font-medium text-emerald-700 opacity-80 group-hover:opacity-100">
                    Abrir
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </DashPanel>
      ) : null}

      {/* ASO + Afastamentos */}
      <div className="grid gap-3 lg:grid-cols-5">
        <DashPanel
          className="lg:col-span-3"
          title="ASOs na competência"
          description="Mesmos indicadores da Gestão de ASOs."
          action={
            aso ? (
              <Link
                href={aso.href}
                className="text-[12px] font-semibold text-emerald-700 hover:underline"
              >
                Abrir módulo
              </Link>
            ) : null
          }
        >
          {aso ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/40 px-4 py-3">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.05em] text-emerald-800/70 uppercase">
                    Aderência
                  </p>
                  <p className="mt-1 text-[32px] leading-none font-semibold tracking-tight tabular-nums text-emerald-900">
                    {aso.aderenciaLabel}
                  </p>
                </div>
                <div className="text-right text-[12px] text-emerald-900/70">
                  <p>
                    {aso.realizados} realizados · {aso.previstosElegiveis}{" "}
                    elegíveis
                  </p>
                  {aso.metaDefined && aso.metaPercent != null ? (
                    <p className="mt-0.5">
                      Meta {aso.metaPercent}%
                      {aso.faltamParaMeta != null && aso.faltamParaMeta > 0
                        ? ` · faltam ${aso.faltamParaMeta}`
                        : " · atingida"}
                    </p>
                  ) : (
                    <p className="mt-0.5">Meta não cadastrada</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <DashStat label="Realizados" value={aso.realizados} tone="ok" />
                <DashStat
                  label="Não realizados"
                  value={aso.naoRealizados}
                  tone={aso.naoRealizados > 0 ? "warn" : "default"}
                />
                <DashStat
                  label="Vencidos"
                  value={aso.vencidos}
                  tone={aso.vencidos > 0 ? "danger" : "default"}
                />
                <DashStat
                  label="Confirmados Alt."
                  value={aso.confirmadosAlterdata}
                  tone="ok"
                />
                <DashStat
                  label="Pend. Alterdata"
                  value={aso.pendentesAlterdata}
                  tone={aso.pendentesAlterdata > 0 ? "warn" : "default"}
                />
                <DashStat label="Justificados" value={aso.justificados} />
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-slate-500">
              Sem dados de ASO para este contexto ou sem permissão.
            </p>
          )}
        </DashPanel>

        <DashPanel
          className="lg:col-span-2"
          title="Afastamentos"
          description="Situação operacional."
          action={
            <Link
              href="/afastamentos?status=ATIVO"
              className="text-[12px] font-semibold text-emerald-700 hover:underline"
            >
              Abrir
            </Link>
          }
        >
          <dl className="divide-y divide-border-subtle">
            <DashRow label="Ativos" value={data.leave.ativos} />
            <DashRow
              label="Sem previsão de retorno"
              value={data.leave.semPrevisao}
            />
            <DashRow
              label="Retornos em 7 dias"
              value={data.leave.retornos7d}
            />
            <DashRow
              label="ASO retorno pendente"
              value={data.leave.asoRetornoPendentes}
              tone={data.leave.asoRetornoPendentes > 0 ? "danger" : "default"}
            />
          </dl>

          {data.leave.proximos.length ? (
            <div className="mt-4 border-t border-border-subtle pt-3">
              <p className="mb-2 text-[10px] font-semibold tracking-[0.05em] text-slate-400 uppercase">
                Próximos retornos
              </p>
              <ul className="space-y-2.5">
                {data.leave.proximos.slice(0, 4).map((r) => (
                  <li key={r.id} className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium text-slate-800">
                      {r.name}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {r.endDate ?? "—"}
                      {r.unitName ? ` · ${r.unitName}` : ""}
                      {r.needsReturnAso ? " · ASO retorno" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DashPanel>
      </div>

      {/* Evolução */}
      <DashPanel
        title="Evolução da aderência"
        description="Janeiro a dezembro no escopo. Meses futuros aparecem em cinza."
      >
        <DashboardEvolutionChart points={data.evolution} />
      </DashPanel>

      {/* Comparativo */}
      {compareRows.length ? (
        <DashPanel
          title={compareTitle}
          description="Aderência ponderada pelos quantitativos — sem média simples."
        >
          <div className="overflow-x-auto">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th className="text-left">Escopo</th>
                  <th className="text-left">Aderência</th>
                  <th className="text-center">Realizados</th>
                  <th className="text-center">Elegíveis</th>
                  <th className="text-center">Vencidos</th>
                  <th className="text-center">Pend. Alt.</th>
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row) => {
                  const href = buildDashboardUrl(data.filterCurrent, {
                    regionId: row.regionId ?? "",
                    unitId: row.unitId ?? "",
                  });
                  const pct = row.aderenciaPercent;
                  return (
                    <tr key={row.key}>
                      <td>
                        <Link
                          href={href}
                          className={cn(
                            "font-medium hover:text-emerald-700",
                            row.cadastralAlert && "text-amber-800",
                          )}
                        >
                          {row.label}
                        </Link>
                      </td>
                      <td>
                        <div className="flex min-w-[140px] items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                pct == null
                                  ? "bg-slate-200"
                                  : pct < 70
                                    ? "bg-red-500"
                                    : pct < 90
                                      ? "bg-amber-500"
                                      : "bg-emerald-500",
                              )}
                              style={{
                                width: `${Math.max(0, Math.min(100, pct ?? 0))}%`,
                              }}
                            />
                          </div>
                          <span className="w-12 shrink-0 text-right text-[12px] tabular-nums text-slate-700">
                            {formatAdherencePercent(row.aderenciaPercent, {
                              realizados: row.realizados,
                              elegiveis: row.elegiveis,
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="text-center tabular-nums">
                        {row.realizados}
                      </td>
                      <td className="text-center tabular-nums">
                        {row.elegiveis}
                      </td>
                      <td className="text-center tabular-nums">
                        {row.vencidos || "—"}
                      </td>
                      <td className="text-center tabular-nums">
                        {row.pendentesAlterdata || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DashPanel>
      ) : null}

      {/* Módulos */}
      <div
        className={cn(
          "grid gap-3",
          [
            data.vaccination,
            data.biological,
            data.pregnancy,
          ].filter(Boolean).length >= 3
            ? "md:grid-cols-3"
            : "md:grid-cols-2",
        )}
      >
        {data.vaccination ? (
          <DashPanel
            title="Vacinação"
            action={
              <Link
                href={data.vaccination.href}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 hover:underline"
              >
                <Syringe className="size-3.5" />
                Abrir
              </Link>
            }
          >
            <dl className="divide-y divide-border-subtle">
              <DashRow label="Com registro" value={data.vaccination.metrics.total} />
              <DashRow
                label="Kit completo"
                value={data.vaccination.metrics.kitComplete}
                tone="ok"
              />
              <DashRow
                label="Incompletos"
                value={data.vaccination.metrics.incomplete}
              />
              <DashRow
                label="Atenção / parcial"
                value={data.vaccination.metrics.attention}
                tone={
                  data.vaccination.metrics.attention > 0 ? "warn" : "default"
                }
              />
            </dl>
          </DashPanel>
        ) : null}

        {data.biological ? (
          <DashPanel
            title="Material biológico"
            action={
              <Link
                href={data.biological.href}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 hover:underline"
              >
                <ShieldAlert className="size-3.5" />
                Abrir
              </Link>
            }
          >
            <dl className="divide-y divide-border-subtle">
              <DashRow
                label="Ocorrências"
                value={data.biological.metrics.total}
              />
              <DashRow
                label="Em acompanhamento"
                value={data.biological.metrics.emAcompanhamento}
              />
              <DashRow
                label="Follow-ups pendentes"
                value={data.biological.metrics.followupsPendentes}
                tone={
                  data.biological.metrics.followupsPendentes > 0
                    ? "warn"
                    : "default"
                }
              />
              <DashRow
                label="Follow-ups atrasados"
                value={data.biological.metrics.followupsAtrasados}
                tone={
                  data.biological.metrics.followupsAtrasados > 0
                    ? "danger"
                    : "default"
                }
              />
            </dl>
          </DashPanel>
        ) : null}

        {data.pregnancy ? (
          <DashPanel
            title="Gestantes"
            action={
              <Link
                href={data.pregnancy.href}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 hover:underline"
              >
                <Baby className="size-3.5" />
                Abrir
              </Link>
            }
          >
            <dl className="divide-y divide-border-subtle">
              <DashRow
                label="Em acompanhamento"
                value={data.pregnancy.emAcompanhamento}
                tone={
                  data.pregnancy.emAcompanhamento > 0 ? "warn" : "default"
                }
              />
              <DashRow
                label="Insalubre sem realocação"
                value={data.pregnancy.insalubreSemRealocacao}
                tone={
                  data.pregnancy.insalubreSemRealocacao > 0
                    ? "danger"
                    : "default"
                }
              />
            </dl>
          </DashPanel>
        ) : null}
      </div>

      {/* Qualidade + sync */}
      <div className="grid gap-3 lg:grid-cols-2">
        <DashPanel title="Qualidade cadastral">
          <dl className="divide-y divide-border-subtle">
            <DashRow label="Sem regional" value={data.quality.semRegional} />
            <DashRow label="Sem unidade" value={data.quality.semUnidade} />
            <DashRow
              label="Ativos sem próximo ASO"
              value={data.quality.semProximoAso}
            />
          </dl>
        </DashPanel>

        <DashPanel
          title="Espelho Alterdata"
          action={
            <Link
              href="/administracao"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 hover:underline"
            >
              <RefreshCw className="size-3.5" />
              Administração
            </Link>
          }
        >
          {data.lastSync ? (
            <dl className="divide-y divide-border-subtle">
              <DashRow
                label="Status"
                value={
                  isSyncPossiblyStale(
                    data.lastSync.createdAt,
                    data.lastSync.status,
                  )
                    ? "Possivelmente interrompida"
                    : humanizeImportBatchStatus(data.lastSync.status)
                }
              />
              <DashRow
                label="Última atualização"
                value={
                  data.lastSync.updatedAt
                    ? formatDateTimeBR(data.lastSync.updatedAt)
                    : "—"
                }
              />
              <DashRow
                label="Importados / atualizados"
                value={`${data.lastSync.importedRows ?? 0} / ${data.lastSync.updatedRows ?? 0}`}
              />
              <DashRow
                label="Com erro"
                value={data.lastSync.errorRows ?? 0}
                tone={(data.lastSync.errorRows ?? 0) > 0 ? "danger" : "default"}
              />
            </dl>
          ) : (
            <p className="text-[13px] text-slate-500">
              Nenhuma sincronização registrada.
            </p>
          )}
        </DashPanel>
      </div>
    </div>
  );
}
