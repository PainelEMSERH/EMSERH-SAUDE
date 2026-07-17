import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Baby,
  ClipboardCheck,
  HeartPulse,
  RefreshCw,
  ShieldAlert,
  Syringe,
  Users,
} from "lucide-react";
import { DashboardEvolutionChart } from "@/components/dashboard/evolution-chart";
import { DashboardFiltersBar } from "@/components/dashboard/filters-bar";
import { DashKpi, DashPanel } from "@/components/dashboard/primitives";
import { StatusBadge } from "@/components/feedback/status-badge";
import { PageHeader } from "@/components/feedback/setup-banner";
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        description="Visão consolidada da saúde ocupacional, pendências e indicadores da EMSERH."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-border bg-slate-50 px-2.5 py-1.5 text-[12px] font-medium text-slate-600">
              {data.contextLabel}
            </span>
            <span className="text-[11px] text-slate-400">
              Atualizado {formatDateTimeBR(data.generatedAt)}
            </span>
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
                  "h-8 text-[12px]",
                )}
              >
                Exportar resumo
              </Link>
            ) : null}
          </div>
        }
      />

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
          label="Colaboradores no escopo"
          value={String(data.headcount.total)}
          hint={`${data.headcount.ativos} ativos · ${data.headcount.afastados} afastados · ${data.headcount.ferias} férias`}
          href="/colaboradores"
          icon={Users}
        />
        <DashKpi
          label="Aderência dos ASOs"
          value={aso?.aderenciaLabel ?? "—"}
          hint={
            aso
              ? `${aso.realizados}/${aso.previstosElegiveis} elegíveis${
                  aso.metaDefined && aso.metaPercent != null
                    ? ` · meta ${aso.metaPercent}%`
                    : " · meta não cadastrada"
                }`
              : "Sem permissão ou sem planejamento"
          }
          href={aso?.href}
          icon={ClipboardCheck}
          tone={
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
                  : "ok"
          }
        />
        <DashKpi
          label="Afastamentos ativos"
          value={String(data.leave.ativos)}
          hint={`${data.leave.retornos7d} retornos em 7 dias · ${data.leave.asoRetornoPendentes} ASO retorno pendente`}
          href="/afastamentos?status=ATIVO"
          icon={HeartPulse}
          tone={data.leave.asoRetornoPendentes > 0 ? "warn" : "default"}
        />
        <DashKpi
          label="Pendências críticas"
          value={String(data.critical)}
          hint="ASOs vencidos + Alterdata pendente + retornos atrasados + sem regional"
          href={aso?.href}
          icon={AlertTriangle}
          tone={data.critical > 0 ? "danger" : "ok"}
        />
      </div>

      {/* Prioridades */}
      {data.priorities.length ? (
        <DashPanel
          title="Prioridades"
          description="Situações que exigem ação no escopo selecionado."
        >
          <ul className="grid gap-2 lg:grid-cols-2">
            {data.priorities.map((p) => (
              <li key={p.id}>
                <Link
                  href={p.href}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle bg-slate-50/80 px-3 py-2.5 transition-colors hover:bg-emerald-50/50"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-semibold text-slate-900">
                        {p.title}
                      </p>
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
                    </div>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      {p.description}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                      {p.module}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] font-medium text-emerald-700">
                    Ver
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </DashPanel>
      ) : null}

      {/* ASO + Leaves */}
      <div className="grid gap-3 lg:grid-cols-3">
        <DashPanel
          className="lg:col-span-2"
          title="Gestão de ASOs"
          description="Mesmos números da tela Gestão de ASOs para o filtro atual."
          action={
            aso ? (
              <Link
                href={aso.href}
                className="text-[12px] font-semibold text-emerald-700 hover:underline"
              >
                Abrir ASOs
              </Link>
            ) : null
          }
        >
          {aso ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Elegíveis", aso.previstosElegiveis],
                  ["Realizados", aso.realizados],
                  ["Confirmados Alt.", aso.confirmadosAlterdata],
                  ["Pend. Alterdata", aso.pendentesAlterdata],
                  ["Não realizados", aso.naoRealizados],
                  ["Vencidos", aso.vencidos],
                  ["Justificados", aso.justificados],
                  ["Previstos brutos", aso.previstosBrutos],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-lg border border-border-subtle bg-slate-50/80 px-2.5 py-2"
                  >
                    <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                      {label}
                    </p>
                    <p className="mt-1 text-[18px] font-semibold tabular-nums text-slate-900">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              {aso.faltamParaMeta != null && aso.metaDefined ? (
                <p className="text-[12px] text-slate-500">
                  Faltam <strong>{aso.faltamParaMeta}</strong> para a meta de{" "}
                  {aso.metaPercent}%.
                </p>
              ) : (
                <p className="text-[12px] text-slate-500">
                  Meta da competência não cadastrada — nenhum valor inventado.
                </p>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-slate-500">
              Sem dados de ASO para este contexto ou sem permissão.
            </p>
          )}
        </DashPanel>

        <DashPanel
          title="Afastamentos e retornos"
          description="Situação operacional no escopo."
          action={
            <Link
              href="/afastamentos?status=ATIVO"
              className="text-[12px] font-semibold text-emerald-700 hover:underline"
            >
              Abrir
            </Link>
          }
        >
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Ativos</dt>
              <dd className="font-semibold tabular-nums">{data.leave.ativos}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Sem previsão de retorno</dt>
              <dd className="font-semibold tabular-nums">
                {data.leave.semPrevisao}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Retornos em 7 dias</dt>
              <dd className="font-semibold tabular-nums">
                {data.leave.retornos7d}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">ASO retorno pendente</dt>
              <dd className="font-semibold tabular-nums text-red-700">
                {data.leave.asoRetornoPendentes}
              </dd>
            </div>
          </dl>
          {data.leave.proximos.length ? (
            <div className="mt-4 border-t border-border-subtle pt-3">
              <p className="mb-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                Próximos retornos
              </p>
              <ul className="space-y-2">
                {data.leave.proximos.map((r) => (
                  <li key={r.id} className="text-[12px]">
                    <p className="font-medium text-slate-800">{r.name}</p>
                    <p className="text-slate-500">
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

      {/* Comparativo */}
      {compareRows.length ? (
        <DashPanel
          title={compareTitle}
          description="Aderência ponderada pelos quantitativos — sem média simples de percentuais."
        >
          <div className="overflow-x-auto">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th className="text-left">Escopo</th>
                  <th className="text-center">Aderência</th>
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
                      <td className="text-center tabular-nums">
                        {formatAdherencePercent(row.aderenciaPercent, {
                          realizados: row.realizados,
                          elegiveis: row.elegiveis,
                        })}
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

      {/* Evolução + atalhos */}
      <div className="grid gap-3 lg:grid-cols-3">
        <DashPanel
          className="lg:col-span-2"
          title="Evolução da aderência de ASOs"
          description="Janeiro a dezembro no escopo atual. Meses futuros não entram como zero."
        >
          <DashboardEvolutionChart points={data.evolution} />
        </DashPanel>

        <DashPanel title="Atalhos operacionais">
          <ul className="space-y-1.5">
            {[
              data.permissions.asos && {
                href: aso?.href ?? "/asos",
                label: "Gestão de ASOs",
                icon: ClipboardCheck,
              },
              data.permissions.leaves && {
                href: "/afastamentos",
                label: "Afastamentos",
                icon: HeartPulse,
              },
              data.permissions.vaccination && {
                href: "/vacinacao",
                label: "Vacinação",
                icon: Syringe,
              },
              data.permissions.biological && {
                href: "/material-biologico",
                label: "Material biológico",
                icon: ShieldAlert,
              },
              data.permissions.reports && {
                href: "/relatorios",
                label: "Relatórios",
                icon: Activity,
              },
            ]
              .filter(Boolean)
              .map((item) => {
                const it = item as {
                  href: string;
                  label: string;
                  icon: typeof Activity;
                };
                const Icon = it.icon;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className="flex items-center gap-2 rounded-lg px-2 py-2 text-[13px] font-medium text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800"
                    >
                      <Icon className="size-4 text-slate-400" />
                      {it.label}
                    </Link>
                  </li>
                );
              })}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            Agenda e Atendimentos não estão disponíveis na navegação atual —
            nenhum indicador fictício é exibido.
          </p>
        </DashPanel>
      </div>

      {/* Módulos secundários */}
      <div className="grid gap-3 md:grid-cols-3">
        {data.vaccination ? (
          <DashPanel
            title="Vacinação"
            action={
              <Link
                href={data.vaccination.href}
                className="text-[12px] font-semibold text-emerald-700 hover:underline"
              >
                Abrir
              </Link>
            }
          >
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-slate-500">Com registro</dt>
                <dd className="font-semibold tabular-nums">
                  {data.vaccination.metrics.total}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Kit completo</dt>
                <dd className="font-semibold tabular-nums text-emerald-800">
                  {data.vaccination.metrics.kitComplete}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Incompletos</dt>
                <dd className="font-semibold tabular-nums">
                  {data.vaccination.metrics.incomplete}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Atenção / parcial</dt>
                <dd className="font-semibold tabular-nums text-amber-800">
                  {data.vaccination.metrics.attention}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] text-slate-400">
              Cobertura % não calculada — só quantitativos do módulo.
            </p>
          </DashPanel>
        ) : null}

        {data.biological ? (
          <DashPanel
            title="Material biológico"
            action={
              <Link
                href={data.biological.href}
                className="text-[12px] font-semibold text-emerald-700 hover:underline"
              >
                Abrir
              </Link>
            }
          >
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-slate-500">Ocorrências</dt>
                <dd className="font-semibold tabular-nums">
                  {data.biological.metrics.total}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Em acompanhamento</dt>
                <dd className="font-semibold tabular-nums">
                  {data.biological.metrics.emAcompanhamento}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Follow-ups pendentes</dt>
                <dd className="font-semibold tabular-nums text-amber-800">
                  {data.biological.metrics.followupsPendentes}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Follow-ups atrasados</dt>
                <dd className="font-semibold tabular-nums text-red-700">
                  {data.biological.metrics.followupsAtrasados}
                </dd>
              </div>
            </dl>
          </DashPanel>
        ) : null}

        {data.pregnancy ? (
          <DashPanel
            title="Gestantes"
            action={
              <Link
                href={data.pregnancy.href}
                className="text-[12px] font-semibold text-emerald-700 hover:underline"
              >
                Abrir
              </Link>
            }
          >
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-slate-500">Em acompanhamento</dt>
                <dd className="font-semibold tabular-nums">
                  {data.pregnancy.emAcompanhamento}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Insalubre s/ realocação</dt>
                <dd className="font-semibold tabular-nums text-red-700">
                  {data.pregnancy.insalubreSemRealocacao}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] text-slate-400">
              Sem dados clínicos ou diagnósticos neste painel.
            </p>
          </DashPanel>
        ) : (
          <DashPanel title="Gestantes">
            <p className="flex items-center gap-2 text-[13px] text-slate-500">
              <Baby className="size-4" />
              Sem permissão para este módulo.
            </p>
          </DashPanel>
        )}
      </div>

      {/* Qualidade + sync */}
      <div className="grid gap-3 lg:grid-cols-2">
        <DashPanel title="Qualidade dos dados">
          <ul className="space-y-2 text-[13px]">
            <li className="flex justify-between gap-2">
              <span className="text-slate-500">Sem regional</span>
              <span className="font-semibold tabular-nums">
                {data.quality.semRegional}
              </span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-slate-500">Sem unidade</span>
              <span className="font-semibold tabular-nums">
                {data.quality.semUnidade}
              </span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-slate-500">Ativos sem próximo ASO</span>
              <span className="font-semibold tabular-nums">
                {data.quality.semProximoAso}
              </span>
            </li>
          </ul>
        </DashPanel>

        <DashPanel
          title="Atualização das bases"
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
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Espelho Alterdata</dt>
                <dd className="font-medium">
                  {isSyncPossiblyStale(
                    data.lastSync.createdAt,
                    data.lastSync.status,
                  )
                    ? "Possivelmente interrompida"
                    : humanizeImportBatchStatus(data.lastSync.status)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Última atualização</dt>
                <dd className="tabular-nums text-slate-700">
                  {data.lastSync.updatedAt
                    ? formatDateTimeBR(data.lastSync.updatedAt)
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Importados / atualizados</dt>
                <dd className="tabular-nums">
                  {data.lastSync.importedRows ?? 0} /{" "}
                  {data.lastSync.updatedRows ?? 0}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Com erro</dt>
                <dd className="tabular-nums text-red-700">
                  {data.lastSync.errorRows ?? 0}
                </dd>
              </div>
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
