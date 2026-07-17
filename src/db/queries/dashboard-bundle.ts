import { and, count, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  asoMonthlyPlans,
  asoRecords,
  employees,
  pregnancyCases,
} from "@/db/schemas";
import { getAsoPanelData, getLastMirrorSync } from "@/db/queries/aso-panel";
import {
  listBiologicalAccidents,
  listLeaves,
  listVaccinations,
} from "@/db/queries/occupational";
import { listRegionsForUser, listUnitsForUser } from "@/db/queries/employees";
import { computeCompetenceMetrics } from "@/lib/aso/indicators";
import { formatAdherencePercent } from "@/lib/aso/format-percent";
import {
  type DashboardFilters,
  dashboardContextLabel,
  asoModuleHref,
} from "@/lib/dashboard/params";
import { resolveLeaveReturnInfo } from "@/lib/leaves/status";
import { employeeScopeCondition } from "@/lib/scope";
import { can } from "@/lib/permissions";
import { formatUnitDisplayName, humanizeLabel } from "@/lib/labels";
import { isDatabaseConfigured } from "@/lib/env";
import type { SessionUser } from "@/types";

export type DashboardPriority = {
  id: string;
  title: string;
  count: number;
  tone: "danger" | "warn" | "info";
  description: string;
  module: string;
  href: string;
};

export type DashboardComparisonRow = {
  key: string;
  label: string;
  regionId: string | null;
  unitId: string | null;
  cadastralAlert?: boolean;
  colaboradores?: number;
  aderenciaPercent: number | null;
  realizados: number;
  elegiveis: number;
  vencidos: number;
  pendentesAlterdata: number;
};

async function countEmployeesByStatus(user: SessionUser) {
  const db = getDb();
  const scope = employeeScopeCondition(user);
  const rows = await db
    .select({
      status: employees.functionalStatus,
      n: count(),
    })
    .from(employees)
    .where(and(isNull(employees.deletedAt), scope))
    .groupBy(employees.functionalStatus);

  const map: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    const key = (r.status || "OUTRO").toUpperCase();
    map[key] = Number(r.n) || 0;
    total += Number(r.n) || 0;
  }
  return {
    total,
    ativos: map.ATIVO ?? 0,
    afastados: map.AFASTADO ?? 0,
    ferias: map.FERIAS ?? 0,
    demitidos: map.DEMITIDO ?? 0,
  };
}

async function pregnancySafeCounts(user: SessionUser) {
  const db = getDb();
  const scope = employeeScopeCondition(user);
  const [emAcomp] = await db
    .select({ n: count() })
    .from(pregnancyCases)
    .innerJoin(employees, eq(pregnancyCases.employeeId, employees.id))
    .where(
      and(
        isNull(pregnancyCases.deletedAt),
        isNull(employees.deletedAt),
        scope,
        eq(pregnancyCases.status, "EM_ACOMPANHAMENTO"),
      ),
    );
  const [insalubre] = await db
    .select({ n: count() })
    .from(pregnancyCases)
    .innerJoin(employees, eq(pregnancyCases.employeeId, employees.id))
    .where(
      and(
        isNull(pregnancyCases.deletedAt),
        isNull(employees.deletedAt),
        scope,
        eq(pregnancyCases.hazardousActivity, true),
        isNull(pregnancyCases.relocationDate),
      ),
    );
  return {
    emAcompanhamento: emAcomp?.n ?? 0,
    insalubreSemRealocacao: insalubre?.n ?? 0,
  };
}

async function qualityCounts(user: SessionUser) {
  const db = getDb();
  const scope = employeeScopeCondition(user);
  const base = and(isNull(employees.deletedAt), scope);

  const [semRegional] = await db
    .select({ n: count() })
    .from(employees)
    .where(and(base, isNull(employees.regionId)));

  const [semUnidade] = await db
    .select({ n: count() })
    .from(employees)
    .where(and(base, isNull(employees.unitId)));

  const [semProximoAso] = await db
    .select({ n: sql<number>`count(distinct ${employees.id})::int` })
    .from(employees)
    .leftJoin(
      asoRecords,
      and(
        eq(asoRecords.employeeId, employees.id),
        isNull(asoRecords.deletedAt),
      ),
    )
    .where(
      and(
        base,
        eq(employees.functionalStatus, "ATIVO"),
        sql`${asoRecords.nextAsoDate} is null`,
      ),
    );

  return {
    semRegional: semRegional?.n ?? 0,
    semUnidade: semUnidade?.n ?? 0,
    semProximoAso: Number(semProximoAso?.n) || 0,
  };
}

/** Comparativo por unidade na competência — mesmos helpers de aderência do painel ASO. */
async function unitMonthComparisons(
  user: SessionUser,
  filters: DashboardFilters,
): Promise<DashboardComparisonRow[]> {
  if (!filters.regionId || filters.unitId) return [];

  const db = getDb();
  const scope = employeeScopeCondition(user);

  const planRows = await db
    .select({
      unitId: asoMonthlyPlans.unitId,
      unitName: asoMonthlyPlans.unitNameSnapshot,
      eligibility: asoMonthlyPlans.eligibility,
      executionStatus: asoMonthlyPlans.executionStatus,
      alterdataStatus: asoMonthlyPlans.alterdataStatus,
      expectedDate: asoMonthlyPlans.expectedDate,
      asoRecordId: asoMonthlyPlans.asoRecordId,
      performedDate: asoRecords.performedDate,
      justificationReason: asoMonthlyPlans.justificationReason,
      functionalStatusSnapshot: asoMonthlyPlans.functionalStatusSnapshot,
    })
    .from(asoMonthlyPlans)
    .leftJoin(asoRecords, eq(asoMonthlyPlans.asoRecordId, asoRecords.id))
    .innerJoin(employees, eq(asoMonthlyPlans.employeeId, employees.id))
    .where(
      and(
        isNull(asoMonthlyPlans.deletedAt),
        isNull(employees.deletedAt),
        scope,
        eq(asoMonthlyPlans.year, filters.year),
        eq(asoMonthlyPlans.month, filters.month),
        eq(asoMonthlyPlans.regionId, filters.regionId),
        eq(asoMonthlyPlans.asoType, "PERIODICO"),
      ),
    );

  const byUnit = new Map<
    string,
    {
      label: string;
      rows: typeof planRows;
    }
  >();

  for (const p of planRows) {
    const key = p.unitId || "SEM_UNIDADE";
    if (!byUnit.has(key)) {
      byUnit.set(key, {
        label: p.unitName
          ? formatUnitDisplayName(p.unitName)
          : "Unidade não informada",
        rows: [],
      });
    }
    byUnit.get(key)!.rows.push(p);
  }

  const out: DashboardComparisonRow[] = [];
  for (const [key, group] of byUnit) {
    const met = computeCompetenceMetrics(group.rows, null);
    out.push({
      key,
      label: group.label,
      regionId: filters.regionId,
      unitId: key === "SEM_UNIDADE" ? null : key,
      cadastralAlert: key === "SEM_UNIDADE",
      aderenciaPercent: met.aderenciaPercent,
      realizados: met.realizados,
      elegiveis: met.previstosElegiveis,
      vencidos: met.vencidos,
      pendentesAlterdata: met.pendentesAlterdata,
    });
  }

  return out.sort((a, b) => b.vencidos - a.vencidos || a.label.localeCompare(b.label));
}

function leaveOpsFromRows(
  rows: Array<{
    leaveType: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    actualReturnDate: string | null;
    requiresReturnAso: boolean | null;
    lastAsoDate?: string | null;
    fullName: string;
    unitName: string | null;
    id: string;
  }>,
) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const in7 = new Date(today);
  in7.setDate(today.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);

  let ativos = 0;
  let semPrevisao = 0;
  let retornos7d = 0;
  let retornosAtrasados = 0;
  let asoRetornoPendentes = 0;

  const proximos: Array<{
    id: string;
    name: string;
    unitName: string | null;
    endDate: string | null;
    returnLabel: string;
    needsReturnAso: boolean;
  }> = [];

  for (const row of rows) {
    const info = resolveLeaveReturnInfo({
      leaveType: row.leaveType,
      status: row.status,
      startDate: row.startDate,
      endDate: row.endDate,
      actualReturnDate: row.actualReturnDate,
      requiresReturnAso: row.requiresReturnAso,
      lastAsoDate: row.lastAsoDate ?? null,
      now: today,
    });

    if (info.displayStatus === "ATIVO") {
      ativos += 1;
      if (!row.endDate) semPrevisao += 1;
      if (row.endDate && row.endDate >= todayStr && row.endDate <= in7Str) {
        retornos7d += 1;
        proximos.push({
          id: row.id,
          name: row.fullName,
          unitName: row.unitName,
          endDate: row.endDate,
          returnLabel: info.returnLabel,
          needsReturnAso: info.needsReturnAso,
        });
      }
    }

    if (
      info.needsReturnAso &&
      !info.returnDone &&
      info.returnLabel === "ASO pendente"
    ) {
      asoRetornoPendentes += 1;
      retornosAtrasados += 1;
    }
  }

  proximos.sort((a, b) =>
    String(a.endDate).localeCompare(String(b.endDate)),
  );

  return {
    ativos,
    semPrevisao,
    retornos7d,
    retornosAtrasados,
    asoRetornoPendentes,
    proximos: proximos.slice(0, 5),
  };
}

export async function getDashboardBundle(
  user: SessionUser,
  filters: DashboardFilters,
) {
  if (!isDatabaseConfigured()) {
    return { configured: false as const };
  }

  const asoParams = {
    year: String(filters.year),
    month: String(filters.month),
    regionId: filters.regionId || undefined,
    unitId: filters.unitId || undefined,
    type: "PERIODICO",
    mode: "monthly",
    page: "1",
  };

  const canPregnancy = can(user, "pregnancy", "view");
  const canVax = can(user, "vaccination", "view");
  const canBio = can(user, "biological", "view");
  const canLeaves = can(user, "leaves", "view");
  const canAsos = can(user, "asos", "view");

  const [
    aso,
    headcount,
    quality,
    leavesResult,
    vaxResult,
    bioResult,
    unitCompare,
    regions,
    units,
    lastSyncFallback,
    pregnancyCounts,
  ] = await Promise.all([
    canAsos
      ? getAsoPanelData(user, asoParams).catch(() => null)
      : Promise.resolve(null),
    countEmployeesByStatus(user).catch(() => ({
      total: 0,
      ativos: 0,
      afastados: 0,
      ferias: 0,
      demitidos: 0,
    })),
    qualityCounts(user).catch(() => ({
      semRegional: 0,
      semUnidade: 0,
      semProximoAso: 0,
    })),
    canLeaves
      ? listLeaves(user, { status: "ATIVO", page: "1" }, { includeClinical: false }).catch(
          () => null,
        )
      : Promise.resolve(null),
    canVax
      ? listVaccinations(user, { page: "1" }).catch(() => null)
      : Promise.resolve(null),
    canBio
      ? listBiologicalAccidents(user, { page: "1" }).catch(() => null)
      : Promise.resolve(null),
    canAsos && filters.regionId && !filters.unitId
      ? unitMonthComparisons(user, filters).catch(() => [])
      : Promise.resolve([]),
    listRegionsForUser(user).catch(() => []),
    listUnitsForUser(user, filters.regionId || undefined).catch(() => []),
    getLastMirrorSync().catch(() => null),
    canPregnancy
      ? pregnancySafeCounts(user).catch(() => ({
          emAcompanhamento: 0,
          insalubreSemRealocacao: 0,
        }))
      : Promise.resolve(null),
  ]);

  const leaveOps = leavesResult
    ? leaveOpsFromRows(
        leavesResult.rows.map((r) => ({
          id: r.id,
          leaveType: r.leaveType,
          status: r.status,
          startDate: r.startDate,
          endDate: r.endDate,
          actualReturnDate: r.actualReturnDate,
          requiresReturnAso: r.requiresReturnAso,
          lastAsoDate: r.lastAsoDate ?? null,
          fullName: r.fullName,
          unitName: r.unitName,
        })),
      )
    : {
        ativos: 0,
        semPrevisao: 0,
        retornos7d: 0,
        retornosAtrasados: 0,
        asoRetornoPendentes: 0,
        proximos: [] as Array<{
          id: string;
          name: string;
          unitName: string | null;
          endDate: string | null;
          returnLabel: string;
          needsReturnAso: boolean;
        }>,
      };

  // Preferir métricas do painel (lista) quando disponível; senão usar agregados.
  const leaveAtivos =
    leavesResult?.metrics.ativos ?? leaveOps.ativos;
  const leaveRetornoPendente =
    leavesResult?.metrics.retornoPendente ?? leaveOps.asoRetornoPendentes;

  const metrics = aso?.metrics ?? null;
  const critical =
    (metrics?.vencidos ?? 0) +
    (metrics?.pendentesAlterdata ?? 0) +
    leaveOps.retornosAtrasados +
    quality.semRegional;

  const regionName =
    aso?.regions.find((r) => r.id === filters.regionId)?.name ??
    regions.find((r) => r.id === filters.regionId)?.name ??
    null;
  const unitName =
    aso?.units.find((u) => u.id === filters.unitId)?.name ??
    units.find((u) => u.id === filters.unitId)?.name ??
    null;

  const contextLabel = dashboardContextLabel({
    year: filters.year,
    month: filters.month,
    regionId: filters.regionId,
    unitId: filters.unitId,
    regionName: regionName ? humanizeLabel(regionName) : null,
    unitName: unitName ? formatUnitDisplayName(unitName) : null,
  });

  const filterCurrent = {
    year: filters.year,
    month: filters.month,
    regionId: filters.regionId || undefined,
    unitId: filters.unitId || undefined,
  };

  const priorities: DashboardPriority[] = [];
  const pushP = (p: DashboardPriority) => {
    if (p.count > 0) priorities.push(p);
  };

  if (metrics) {
    pushP({
      id: "aso-vencidos",
      title: "ASOs vencidos",
      count: metrics.vencidos,
      tone: "danger",
      description: "Previstos elegíveis com prazo ultrapassado na competência.",
      module: "ASOs",
      href: asoModuleHref(filters, { overdueOnly: "1" }),
    });
    pushP({
      id: "aso-alterdata",
      title: "Realizados pendentes no Alterdata",
      count: metrics.pendentesAlterdata,
      tone: "warn",
      description: "Executados no sistema sem confirmação no espelho.",
      module: "ASOs",
      href: asoModuleHref(filters, { alterdata: "PENDENTE_ESPELHO" }),
    });
  }

  pushP({
    id: "retornos-atrasados",
    title: "ASOs de retorno pendentes",
    count: leaveOps.asoRetornoPendentes,
    tone: "danger",
    description: "Afastamentos encerrados sem evidência de ASO de retorno.",
    module: "Afastamentos",
    href: `/afastamentos?returnPending=1`,
  });

  pushP({
    id: "retornos-7d",
    title: "Retornos em até 7 dias",
    count: leaveOps.retornos7d,
    tone: "warn",
    description: "Afastamentos ativos com término previsto na próxima semana.",
    module: "Afastamentos",
    href: `/afastamentos?status=ATIVO`,
  });

  pushP({
    id: "sem-regional",
    title: "Colaboradores sem regional",
    count: quality.semRegional,
    tone: "warn",
    description: "Cadastros sem vínculo regional — qualidade da base.",
    module: "Colaboradores",
    href: `/colaboradores`,
  });

  if (bioResult?.metrics.followupsAtrasados) {
    pushP({
      id: "bio-atrasados",
      title: "Follow-ups biológicos atrasados",
      count: bioResult.metrics.followupsAtrasados,
      tone: "danger",
      description: "Acompanhamentos D30/D60/D90 vencidos.",
      module: "Material biológico",
      href: `/material-biologico?followup=overdue`,
    });
  }

  priorities.sort((a, b) => {
    const rank = { danger: 0, warn: 1, info: 2 } as const;
    return rank[a.tone] - rank[b.tone] || b.count - a.count;
  });

  // Comparativo regional a partir da matriz (mês atual)
  const regionalCompare: DashboardComparisonRow[] = [];
  if (aso && !filters.regionId && !filters.unitId) {
    for (const row of aso.matrixRows) {
      if (row.key === "EMSERH") continue;
      const cell = row.cells.find((c) => c.month === filters.month);
      if (!cell) continue;
      regionalCompare.push({
        key: row.key,
        label: row.label,
        regionId: row.regionId,
        unitId: null,
        cadastralAlert: row.cadastralAlert,
        aderenciaPercent: cell.percent,
        realizados: cell.realizados,
        elegiveis: cell.elegiveis,
        vencidos: 0,
        pendentesAlterdata: 0,
      });
    }
  }

  const evolution =
    aso?.matrixRows
      .find(
        (r) =>
          r.key ===
          (filters.unitId ||
            filters.regionId ||
            (user.scopeLevel === "EMSERH" ? "EMSERH" : aso.matrixRows[0]?.key)),
      )
      ?.cells.map((c) => ({
        month: c.month,
        percent: c.percent,
        realizados: c.realizados,
        elegiveis: c.elegiveis,
        meta: c.meta,
        tone: c.tone,
      })) ?? [];

  const lastSync = aso?.lastSync ?? lastSyncFallback;

  return {
    configured: true as const,
    generatedAt: new Date().toISOString(),
    filters,
    contextLabel,
    filterCurrent,
    years: aso?.years ?? [filters.year],
    regions: (aso?.regions ?? regions).map((r) => ({
      id: r.id,
      name: r.name,
      code: "code" in r ? r.code : undefined,
    })),
    units: (aso?.units ?? units).map((u) => ({
      id: u.id,
      name: u.name,
      regionId: "regionId" in u ? u.regionId : filters.regionId || null,
    })),
    headcount,
    aso: metrics
      ? {
          ...metrics,
          aderenciaLabel: formatAdherencePercent(metrics.aderenciaPercent, {
            realizados: metrics.realizados,
            elegiveis: metrics.previstosElegiveis,
          }),
          href: asoModuleHref(filters),
        }
      : null,
    leave: {
      ...leaveOps,
      ativos: leaveAtivos,
      retornoPendente: leaveRetornoPendente,
      asoRetornoPendentes: Math.max(
        leaveOps.asoRetornoPendentes,
        leaveRetornoPendente,
      ),
      metrics: leavesResult?.metrics ?? null,
      href: `/afastamentos`,
    },
    critical,
    priorities,
    vaccination: vaxResult
      ? {
          metrics: vaxResult.metrics,
          href: `/vacinacao`,
        }
      : null,
    biological: bioResult
      ? {
          metrics: bioResult.metrics,
          href: `/material-biologico`,
        }
      : null,
    pregnancy: pregnancyCounts
      ? {
          ...pregnancyCounts,
          href: "/gestantes",
        }
      : null,
    regionalCompare,
    unitCompare,
    evolution,
    quality,
    lastSync,
    canExport: can(user, "reports", "export") || can(user, "asos", "export"),
    permissions: {
      asos: canAsos,
      leaves: canLeaves,
      vaccination: canVax,
      biological: canBio,
      pregnancy: canPregnancy,
      reports: can(user, "reports", "view"),
    },
  };
}

export type DashboardBundle = Awaited<ReturnType<typeof getDashboardBundle>>;
