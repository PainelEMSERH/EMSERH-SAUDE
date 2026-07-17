import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "@/db";
import {
  asoAlterdataSnapshots,
  asoCompetenceClosures,
  asoMonthlyPlans,
  asoRecords,
  asoTargets,
  employees,
  importBatches,
  leaveRecords,
  regions,
  units,
} from "@/db/schemas";
import {
  computeCompetenceMetrics,
  consolidateWeighted,
  matrixCellTone,
} from "@/lib/aso/indicators";
import {
  eligibilityFromFunctionalStatus,
  yearMonthFromDate,
} from "@/lib/aso/planning";
import { resolveTrustedPeriodicNext } from "@/lib/aso/prediction";
import { MONTH_LABELS } from "@/lib/aso/constants";
import {
  isDueWithinDays,
  isPlanOverdue,
} from "@/lib/aso/execution";
import { reconcileAlterdataStatus } from "@/lib/aso/reconciliation";
import { humanizeLabel } from "@/lib/labels";
import { employeeScopeCondition, parsePage, parsePageSize } from "@/lib/scope";
import type { SessionUser } from "@/types";

export type AsoPanelParams = {
  year?: string;
  month?: string;
  regionId?: string;
  unitId?: string;
  type?: string;
  mode?: string;
  q?: string;
  execution?: string;
  alterdata?: string;
  functional?: string;
  pendingOnly?: string;
  divergencesOnly?: string;
  overdueOnly?: string;
  page?: string;
  priority?: string;
};

function clampScope(
  user: SessionUser,
  regionId: string,
  unitId: string,
): { regionId: string; unitId: string } {
  let r = regionId === "ALL" ? "" : regionId;
  let u = unitId === "ALL" ? "" : unitId;
  if (user.scopeLevel === "UNIT") {
    if (user.unitIds.length === 1) u = user.unitIds[0];
    else if (u && !user.unitIds.includes(u)) u = "";
    r = "";
  } else if (user.scopeLevel === "REGION") {
    if (r && !user.regionIds.includes(r)) r = "";
    if (!r && user.regionIds.length === 1) r = user.regionIds[0];
  }
  return { regionId: r, unitId: u };
}

export async function getLastMirrorSync() {
  const db = getDb();
  const [row] = await db
    .select({
      id: importBatches.id,
      status: importBatches.status,
      updatedAt: importBatches.updatedAt,
      createdAt: importBatches.createdAt,
      importedRows: importBatches.importedRows,
      updatedRows: importBatches.updatedRows,
      errorRows: importBatches.errorRows,
      sourceName: importBatches.sourceName,
    })
    .from(importBatches)
    .where(
      or(
        sql`${importBatches.sourceName} like 'mirror:%'`,
        sql`${importBatches.sourceName} like 'mirror-aso:%'`,
        sql`${importBatches.sourceName} like 'mirror-fast:%'`,
      ),
    )
    .orderBy(desc(importBatches.createdAt))
    .limit(1);
  return row ?? null;
}

export async function listAsoYears() {
  const db = getDb();
  const fromPlans = await db
    .selectDistinct({ year: asoMonthlyPlans.year })
    .from(asoMonthlyPlans)
    .where(isNull(asoMonthlyPlans.deletedAt))
    .orderBy(desc(asoMonthlyPlans.year));
  const current = new Date().getFullYear();
  const years = new Set<number>([current, current - 1, current + 1]);
  for (const r of fromPlans) years.add(r.year);
  return [...years].sort((a, b) => b - a);
}

async function listScopedRegions(user: SessionUser) {
  const db = getDb();
  const base = and(isNull(regions.deletedAt), eq(regions.isActive, true));
  if (user.scopeLevel === "EMSERH") {
    return db.select().from(regions).where(base).orderBy(regions.name);
  }
  if (user.scopeLevel === "REGION" && user.regionIds.length) {
    return db
      .select()
      .from(regions)
      .where(and(base, inArray(regions.id, user.regionIds)))
      .orderBy(regions.name);
  }
  if (user.scopeLevel === "UNIT" && user.unitIds.length) {
    const unitRows = await db
      .select({ regionId: units.regionId })
      .from(units)
      .where(and(isNull(units.deletedAt), inArray(units.id, user.unitIds)));
    const ids = [
      ...new Set(unitRows.map((u) => u.regionId).filter(Boolean) as string[]),
    ];
    if (!ids.length) return [];
    return db
      .select()
      .from(regions)
      .where(and(base, inArray(regions.id, ids)))
      .orderBy(regions.name);
  }
  return [];
}

async function listScopedUnits(user: SessionUser, regionId?: string) {
  const db = getDb();
  const filters = [isNull(units.deletedAt), eq(units.isActive, true)];
  if (user.scopeLevel === "UNIT") {
    if (!user.unitIds.length) return [];
    filters.push(inArray(units.id, user.unitIds));
  } else if (user.scopeLevel === "REGION") {
    if (!user.regionIds.length) return [];
    filters.push(inArray(units.regionId, user.regionIds));
  }
  if (regionId) filters.push(eq(units.regionId, regionId));
  return db
    .select({
      id: units.id,
      name: units.name,
      regionId: units.regionId,
    })
    .from(units)
    .where(and(...filters))
    .orderBy(units.name);
}

function planScopeFilters(
  user: SessionUser,
  regionId: string,
  unitId: string,
  asoType: string,
  year: number,
  months: number[],
) {
  return [
    isNull(asoMonthlyPlans.deletedAt),
    eq(asoMonthlyPlans.year, year),
    inArray(asoMonthlyPlans.month, months),
    asoType !== "ALL" ? eq(asoMonthlyPlans.asoType, asoType) : undefined,
    regionId ? eq(asoMonthlyPlans.regionId, regionId) : undefined,
    unitId ? eq(asoMonthlyPlans.unitId, unitId) : undefined,
    user.scopeLevel === "REGION" && user.regionIds.length
      ? inArray(asoMonthlyPlans.regionId, user.regionIds)
      : undefined,
    user.scopeLevel === "UNIT" && user.unitIds.length
      ? inArray(asoMonthlyPlans.unitId, user.unitIds)
      : undefined,
  ].filter(Boolean);
}

export async function getAsoPanelData(user: SessionUser, params: AsoPanelParams) {
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Math.min(12, Math.max(1, Number(params.month) || now.getMonth() + 1));
  const asoType = params.type && params.type !== "ALL" ? params.type : "ALL";
  const mode = params.mode === "accumulated" ? "accumulated" : "monthly";
  let { regionId, unitId } = clampScope(
    user,
    params.regionId || "",
    params.unitId || "",
  );

  const months = mode === "accumulated"
    ? Array.from({ length: month }, (_, i) => i + 1)
    : [month];

  const db = getDb();
  const [years, regionRows, unitRows, lastSync, closure] = await Promise.all([
    listAsoYears(),
    listScopedRegions(user),
    listScopedUnits(user, regionId || undefined),
    getLastMirrorSync(),
    db
      .select()
      .from(asoCompetenceClosures)
      .where(
        and(
          eq(asoCompetenceClosures.year, year),
          eq(asoCompetenceClosures.month, month),
          eq(asoCompetenceClosures.asoType, asoType === "ALL" ? "ALL" : asoType),
          eq(
            asoCompetenceClosures.scopeType,
            unitId ? "UNIT" : regionId ? "REGION" : "EMSERH",
          ),
          regionId
            ? eq(asoCompetenceClosures.regionId, regionId)
            : isNull(asoCompetenceClosures.regionId),
          unitId
            ? eq(asoCompetenceClosures.unitId, unitId)
            : isNull(asoCompetenceClosures.unitId),
        ),
      )
      .limit(1)
      .then((r) => r[0] ?? null),
  ]);

  // URL com regional inativa (ex.: NAO_INFORMADA) → ignora o filtro
  if (regionId && !regionRows.some((r) => r.id === regionId)) {
    regionId = "";
  }

  const whereParts = planScopeFilters(
    user,
    regionId,
    unitId,
    asoType,
    year,
    months,
  );

  const planRows = await db
    .select({
      id: asoMonthlyPlans.id,
      employeeId: asoMonthlyPlans.employeeId,
      registration: asoMonthlyPlans.registration,
      employeeName: asoMonthlyPlans.employeeName,
      asoType: asoMonthlyPlans.asoType,
      year: asoMonthlyPlans.year,
      month: asoMonthlyPlans.month,
      expectedDate: asoMonthlyPlans.expectedDate,
      regionId: asoMonthlyPlans.regionId,
      unitId: asoMonthlyPlans.unitId,
      regionNameSnapshot: asoMonthlyPlans.regionNameSnapshot,
      unitNameSnapshot: asoMonthlyPlans.unitNameSnapshot,
      functionalStatusSnapshot: asoMonthlyPlans.functionalStatusSnapshot,
      eligibility: asoMonthlyPlans.eligibility,
      justificationReason: asoMonthlyPlans.justificationReason,
      executionStatus: asoMonthlyPlans.executionStatus,
      alterdataStatus: asoMonthlyPlans.alterdataStatus,
      asoRecordId: asoMonthlyPlans.asoRecordId,
      frozen: asoMonthlyPlans.frozen,
      predictionOrigin: asoMonthlyPlans.predictionOrigin,
      performedDate: asoRecords.performedDate,
      result: asoRecords.result,
      nextAsoDate: asoRecords.nextAsoDate,
      recordUpdatedAt: asoRecords.updatedAt,
    })
    .from(asoMonthlyPlans)
    .leftJoin(asoRecords, eq(asoMonthlyPlans.asoRecordId, asoRecords.id))
    .where(and(...whereParts));

  // Meta
  const [target] = await db
    .select()
    .from(asoTargets)
    .where(
      and(
        isNull(asoTargets.deletedAt),
        eq(asoTargets.year, year),
        eq(asoTargets.month, month),
        eq(asoTargets.asoType, asoType === "ALL" ? "ALL" : asoType),
        eq(asoTargets.scopeType, unitId ? "UNIT" : regionId ? "REGION" : "EMSERH"),
        regionId ? eq(asoTargets.regionId, regionId) : isNull(asoTargets.regionId),
        unitId ? eq(asoTargets.unitId, unitId) : isNull(asoTargets.unitId),
      ),
    )
    .limit(1);

  const metrics = computeCompetenceMetrics(
    planRows.map((p) => ({
      eligibility: p.eligibility,
      executionStatus: p.executionStatus,
      alterdataStatus: p.alterdataStatus,
      expectedDate: p.expectedDate,
      asoRecordId: p.asoRecordId,
      performedDate: p.performedDate,
    })),
    target?.targetPercent ?? null,
  );

  // Matriz anual
  const yearPlans = await db
    .select({
      month: asoMonthlyPlans.month,
      regionId: asoMonthlyPlans.regionId,
      unitId: asoMonthlyPlans.unitId,
      regionName: asoMonthlyPlans.regionNameSnapshot,
      unitName: asoMonthlyPlans.unitNameSnapshot,
      eligibility: asoMonthlyPlans.eligibility,
      executionStatus: asoMonthlyPlans.executionStatus,
      expectedDate: asoMonthlyPlans.expectedDate,
      asoRecordId: asoMonthlyPlans.asoRecordId,
    })
    .from(asoMonthlyPlans)
    .where(
      and(
        ...planScopeFilters(user, regionId, unitId, asoType, year, [
          1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
        ]),
      ),
    );

  const targetsYear = await db
    .select()
    .from(asoTargets)
    .where(
      and(
        isNull(asoTargets.deletedAt),
        eq(asoTargets.year, year),
        eq(asoTargets.asoType, asoType === "ALL" ? "ALL" : asoType),
      ),
    );

  type MatrixRow = {
    key: string;
    label: string;
    regionId: string | null;
    unitId: string | null;
    cadastralAlert?: boolean;
    cells: Array<{
      month: number;
      realizados: number;
      elegiveis: number;
      percent: number | null;
      meta: number | null;
      tone: ReturnType<typeof matrixCellTone>;
    }>;
  };

  function buildCells(
    rows: typeof yearPlans,
    scopeRegionId: string | null,
    scopeUnitId: string | null,
  ) {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const subset = rows.filter((r) => r.month === m);
      const met = computeCompetenceMetrics(
        subset.map((s) => ({
          eligibility: s.eligibility,
          executionStatus: s.executionStatus,
          expectedDate: s.expectedDate,
          asoRecordId: s.asoRecordId,
        })),
        targetsYear.find(
          (t) =>
            t.month === m &&
            t.scopeType ===
              (scopeUnitId ? "UNIT" : scopeRegionId ? "REGION" : "EMSERH") &&
            (scopeRegionId ? t.regionId === scopeRegionId : !t.regionId) &&
            (scopeUnitId ? t.unitId === scopeUnitId : !t.unitId),
        )?.targetPercent ??
          targetsYear.find(
            (t) =>
              t.month === m && t.scopeType === "EMSERH" && !t.regionId && !t.unitId,
          )?.targetPercent ??
          null,
      );
      const isFuture =
        year > now.getFullYear() ||
        (year === now.getFullYear() && m > now.getMonth() + 1);
      return {
        month: m,
        realizados: met.realizados,
        elegiveis: met.previstosElegiveis,
        percent: isFuture ? null : met.aderenciaPercent,
        meta: met.metaPercent,
        tone: matrixCellTone({
          percent: isFuture ? null : met.aderenciaPercent,
          metaPercent: met.metaPercent,
          hasDenominator: met.previstosElegiveis > 0,
          isFuture,
        }),
      };
    });
  }

  function scopeLabel(raw: string | null | undefined, fallback: string) {
    const name = (raw || "").trim();
    if (!name) return fallback;
    const upper = name.toUpperCase().replace(/\s+/g, "_");
    if (upper === "NAO_INFORMADA" || upper === "NAO_INFORMADO") {
      return "Regional não informada";
    }
    return humanizeLabel(name);
  }

  const matrixRows: MatrixRow[] = [];
  if (!regionId && user.scopeLevel === "EMSERH") {
    matrixRows.push({
      key: "EMSERH",
      label: "EMSERH",
      regionId: null,
      unitId: null,
      cells: buildCells(yearPlans, null, null),
    });
    for (const reg of regionRows) {
      const subset = yearPlans.filter((p) => p.regionId === reg.id);
      const label = scopeLabel(reg.name, "Regional");
      matrixRows.push({
        key: reg.id,
        label,
        regionId: reg.id,
        unitId: null,
        cells: buildCells(subset, reg.id, null),
        cadastralAlert: label === "Regional não informada",
      });
    }
  } else {
    const regLabel = scopeLabel(
      regionRows.find((r) => r.id === regionId)?.name ||
        yearPlans.find((p) => p.regionId === regionId)?.regionName ||
        "Regional",
      "Regional",
    );
    matrixRows.push({
      key: regionId || "region",
      label: regLabel,
      regionId: regionId || null,
      unitId: null,
      cells: buildCells(yearPlans, regionId || null, null),
      cadastralAlert: regLabel === "Regional não informada",
    });
    const unitIds = [...new Set(yearPlans.map((p) => p.unitId).filter(Boolean))] as string[];
    for (const uid of unitIds) {
      const subset = yearPlans.filter((p) => p.unitId === uid);
      const label =
        unitRows.find((u) => u.id === uid)?.name ||
        subset[0]?.unitName ||
        "Unidade";
      matrixRows.push({
        key: uid,
        label: humanizeLabel(label),
        regionId: regionId || null,
        unitId: uid,
        cells: buildCells(subset, regionId || null, uid),
      });
    }
  }

  // Série anual para gráfico (escopo atual)
  const chartSeries = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const subset = yearPlans.filter((p) => p.month === m);
    const isFuture =
      year > now.getFullYear() ||
      (year === now.getFullYear() && m > now.getMonth() + 1);
    const met = computeCompetenceMetrics(
      subset.map((s) => ({
        eligibility: s.eligibility,
        executionStatus: s.executionStatus,
        expectedDate: s.expectedDate,
        asoRecordId: s.asoRecordId,
      })),
      targetsYear.find(
        (t) =>
          t.month === m &&
          t.scopeType ===
            (unitId ? "UNIT" : regionId ? "REGION" : "EMSERH"),
      )?.targetPercent ?? null,
    );
    return {
      month: m,
      label: MONTH_LABELS[i],
      resultado: isFuture ? null : met.aderenciaPercent,
      meta: met.metaPercent,
      realizados: met.realizados,
      elegiveis: met.previstosElegiveis,
    };
  });

  // Prioridades: competência selecionada × visão anual (mesmo ano/tipo/escopo)
  const yearOpen = await db
    .select({
      month: asoMonthlyPlans.month,
      executionStatus: asoMonthlyPlans.executionStatus,
      alterdataStatus: asoMonthlyPlans.alterdataStatus,
      expectedDate: asoMonthlyPlans.expectedDate,
      eligibility: asoMonthlyPlans.eligibility,
      functionalStatusSnapshot: asoMonthlyPlans.functionalStatusSnapshot,
      asoRecordId: asoMonthlyPlans.asoRecordId,
      frozen: asoMonthlyPlans.frozen,
    })
    .from(asoMonthlyPlans)
    .where(
      and(
        ...planScopeFilters(
          user,
          regionId,
          unitId,
          asoType,
          year,
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        ),
      ),
    );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function countPriorities(
    rows: Array<{
      executionStatus: string;
      alterdataStatus: string;
      expectedDate: string | null;
      eligibility: string;
      functionalStatusSnapshot: string | null;
      asoRecordId: string | null;
    }>,
  ) {
    return {
      vencidos: rows.filter((p) =>
        isPlanOverdue(
          {
            eligibility: p.eligibility,
            executionStatus: p.executionStatus,
            expectedDate: p.expectedDate,
            asoRecordId: p.asoRecordId,
          },
          today,
        ),
      ).length,
      vencendo7: rows.filter((p) =>
        isDueWithinDays(
          {
            eligibility: p.eligibility,
            executionStatus: p.executionStatus,
            expectedDate: p.expectedDate,
            asoRecordId: p.asoRecordId,
          },
          7,
          today,
        ),
      ).length,
      vencendo30: rows.filter((p) =>
        isDueWithinDays(
          {
            eligibility: p.eligibility,
            executionStatus: p.executionStatus,
            expectedDate: p.expectedDate,
            asoRecordId: p.asoRecordId,
          },
          30,
          today,
        ),
      ).length,
      pendentesAlterdata: rows.filter(
        (p) =>
          p.alterdataStatus === "PENDENTE_ATUALIZACAO" ||
          p.alterdataStatus === "AGUARDANDO_SINCRONIZACAO",
      ).length,
      divergencias: rows.filter((p) => p.alterdataStatus === "DIVERGENCIA_DATA")
        .length,
      atualizadoSemRegistro: rows.filter(
        (p) => p.alterdataStatus === "ATUALIZADO_SEM_REGISTRO",
      ).length,
      semProximoAso: rows.filter((p) => !p.expectedDate).length,
      afastadosRetorno: rows.filter(
        (p) => p.functionalStatusSnapshot === "AFASTADO",
      ).length,
      competenciasAguardando: 0,
    };
  }

  const competenceRows = yearOpen.filter((p) => p.month === month);
  const priorities = {
    ...countPriorities(competenceRows),
    competenciasAguardando: closure?.status === "EM_CONFERENCIA" ? 1 : 0,
  };
  const yearPriorities = {
    ...countPriorities(yearOpen),
    competenciasAguardando: closure?.status === "EM_CONFERENCIA" ? 1 : 0,
  };

  // Relação nominal filtrada
  let nominal = planRows;
  if (params.q?.trim()) {
    const q = params.q.trim().toLowerCase();
    nominal = nominal.filter(
      (p) =>
        p.employeeName.toLowerCase().includes(q) ||
        p.registration.toLowerCase().includes(q),
    );
  }
  if (params.execution && params.execution !== "ALL") {
    nominal = nominal.filter((p) => p.executionStatus === params.execution);
  }
  if (params.alterdata && params.alterdata !== "ALL") {
    nominal = nominal.filter((p) => p.alterdataStatus === params.alterdata);
  }
  if (params.functional && params.functional !== "ALL") {
    nominal = nominal.filter(
      (p) => p.functionalStatusSnapshot === params.functional,
    );
  }
  if (params.pendingOnly === "1") {
    nominal = nominal.filter(
      (p) =>
        p.eligibility === "ELEGIVEL" &&
        p.executionStatus !== "REALIZADO" &&
        p.executionStatus !== "JUSTIFICADO" &&
        p.executionStatus !== "DISPENSADO",
    );
  }
  if (params.divergencesOnly === "1") {
    nominal = nominal.filter((p) => p.alterdataStatus === "DIVERGENCIA_DATA");
  }
  if (params.overdueOnly === "1" || params.priority === "vencidos") {
    nominal = nominal.filter((p) =>
      isPlanOverdue(
        {
          eligibility: p.eligibility,
          executionStatus: p.executionStatus,
          expectedDate: p.expectedDate,
          asoRecordId: p.asoRecordId,
          performedDate: p.performedDate,
        },
        today,
      ),
    );
  }
  if (params.priority === "vencendo7") {
    nominal = nominal.filter((p) =>
      isDueWithinDays(
        {
          eligibility: p.eligibility,
          executionStatus: p.executionStatus,
          expectedDate: p.expectedDate,
          asoRecordId: p.asoRecordId,
          performedDate: p.performedDate,
        },
        7,
        today,
      ),
    );
  }
  if (params.priority === "vencendo30") {
    nominal = nominal.filter((p) =>
      isDueWithinDays(
        {
          eligibility: p.eligibility,
          executionStatus: p.executionStatus,
          expectedDate: p.expectedDate,
          asoRecordId: p.asoRecordId,
          performedDate: p.performedDate,
        },
        30,
        today,
      ),
    );
  }
  if (params.priority === "pendentesAlterdata") {
    nominal = nominal.filter(
      (p) =>
        p.alterdataStatus === "PENDENTE_ATUALIZACAO" ||
        p.alterdataStatus === "AGUARDANDO_SINCRONIZACAO",
    );
  }
  if (params.priority === "divergencias") {
    nominal = nominal.filter((p) => p.alterdataStatus === "DIVERGENCIA_DATA");
  }

  const page = parsePage(params.page);
  const pageSize = parsePageSize(undefined);
  const total = nominal.length;
  const pageRows = nominal.slice((page - 1) * pageSize, page * pageSize);

  // Regional weighted check for consolidado display
  const byRegion = new Map<string, { realizados: number; elegiveis: number }>();
  if (!regionId) {
    for (const reg of regionRows) {
      const subset = planRows.filter((p) => p.regionId === reg.id);
      const m = computeCompetenceMetrics(
        subset.map((s) => ({
          eligibility: s.eligibility,
          executionStatus: s.executionStatus,
          expectedDate: s.expectedDate,
          asoRecordId: s.asoRecordId,
          performedDate: s.performedDate,
        })),
      );
      byRegion.set(reg.id, {
        realizados: m.realizados,
        elegiveis: m.previstosElegiveis,
      });
    }
  }
  const weightedCheck = consolidateWeighted(
    [...byRegion.values()].map((v) => ({
      realizados: v.realizados,
      previstosElegiveis: v.elegiveis,
    })),
  );

  return {
    year,
    month,
    regionId: regionId || undefined,
    unitId: unitId || undefined,
    asoType,
    mode,
    years,
    regions: regionRows.map((r) => ({ id: r.id, name: r.name, code: r.code })),
    units: unitRows,
    lastSync,
    closure,
    metrics,
    weightedCheck,
    matrixRows,
    chartSeries,
    priorities,
    yearPriorities,
    distribution: {
      realizadoConfirmado: metrics.confirmadosAlterdata,
      realizadoPendente: metrics.pendentesAlterdata,
      naoRealizado: metrics.naoRealizados,
      justificado: metrics.justificados,
      vencido: metrics.vencidos,
    },
    nominal: {
      rows: pageRows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    targetPercent: target?.targetPercent ?? null,
    canSeeAllRegions: user.scopeLevel === "EMSERH",
  };
}

/**
 * Gera/atualiza planejamento anual de forma idempotente.
 * Não reescreve itens frozen / competências FECHADAS.
 */
export async function generateAsoPlanningForYear(
  user: SessionUser,
  year: number,
) {
  const db = getDb();

  const closed = await db
    .select()
    .from(asoCompetenceClosures)
    .where(
      and(
        eq(asoCompetenceClosures.year, year),
        eq(asoCompetenceClosures.status, "FECHADA"),
      ),
    );
  const closedMonths = new Set(
    closed
      .filter((c) => c.asoType === "ALL" || c.asoType === "PERIODICO")
      .map((c) => c.month),
  );

  const empScope = employeeScopeCondition(user);
  const empRows = await db
    .select({
      id: employees.id,
      registration: employees.registration,
      fullName: employees.fullName,
      functionalStatus: employees.functionalStatus,
      admissionDate: employees.admissionDate,
      dismissalDate: employees.dismissalDate,
      regionId: employees.regionId,
      unitId: employees.unitId,
      regionName: regions.name,
      unitName: units.name,
    })
    .from(employees)
    .leftJoin(regions, eq(employees.regionId, regions.id))
    .leftJoin(units, eq(employees.unitId, units.id))
    .where(and(isNull(employees.deletedAt), empScope));

  const snapRows = await db
    .select({
      employeeId: asoAlterdataSnapshots.employeeId,
      nextAsoDate: asoAlterdataSnapshots.nextAsoDate,
      lastAsoDate: asoAlterdataSnapshots.lastAsoDate,
      periodicityMonths: asoAlterdataSnapshots.periodicityMonths,
      syncedAt: asoAlterdataSnapshots.syncedAt,
    })
    .from(asoAlterdataSnapshots)
    .orderBy(desc(asoAlterdataSnapshots.syncedAt));

  const snapMap = new Map<
    string,
    {
      nextAsoDate: string | null;
      lastAsoDate: string | null;
      periodicityMonths: number | null;
    }
  >();
  for (const r of snapRows) {
    if (!snapMap.has(r.employeeId)) {
      snapMap.set(r.employeeId, {
        nextAsoDate: r.nextAsoDate,
        lastAsoDate: r.lastAsoDate,
        periodicityMonths: r.periodicityMonths,
      });
    }
  }

  // Fallback: next/last from aso_records
  const nextFromRecords = await db
    .select({
      employeeId: asoRecords.employeeId,
      nextAsoDate: asoRecords.nextAsoDate,
      lastAsoDate: asoRecords.lastAsoDate,
      performedDate: asoRecords.performedDate,
      periodicityMonths: asoRecords.periodicityMonths,
    })
    .from(asoRecords)
    .where(and(isNull(asoRecords.deletedAt)));

  for (const rec of nextFromRecords) {
    const existing = snapMap.get(rec.employeeId);
    if (!existing) {
      snapMap.set(rec.employeeId, {
        nextAsoDate: rec.nextAsoDate,
        lastAsoDate: rec.lastAsoDate ?? rec.performedDate,
        periodicityMonths: rec.periodicityMonths,
      });
      continue;
    }
    if (!existing.nextAsoDate && rec.nextAsoDate) {
      existing.nextAsoDate = rec.nextAsoDate;
    }
    if (!existing.lastAsoDate && (rec.lastAsoDate || rec.performedDate)) {
      existing.lastAsoDate = rec.lastAsoDate ?? rec.performedDate;
    }
    if (!existing.periodicityMonths && rec.periodicityMonths) {
      existing.periodicityMonths = rec.periodicityMonths;
    }
  }

  let upserted = 0;
  let skipped = 0;
  let cleaned = 0;

  async function upsertPlan(input: {
    employeeId: string;
    registration: string;
    employeeName: string;
    asoType: string;
    year: number;
    month: number;
    expectedDate: string | null;
    regionId: string | null;
    unitId: string | null;
    regionName: string | null;
    unitName: string | null;
    functionalStatus: string | null;
    origin: string;
    /** Quando true, marca admissional como realizado por evidência Alterdata. */
    markRealizedFromAlterdata?: boolean;
    alterdataPerformedDate?: string | null;
  }) {
    if (closedMonths.has(input.month) && input.asoType === "PERIODICO") {
      skipped += 1;
      return;
    }
    const elig = eligibilityFromFunctionalStatus(input.functionalStatus);
    const [existing] = await db
      .select()
      .from(asoMonthlyPlans)
      .where(
        and(
          eq(asoMonthlyPlans.employeeId, input.employeeId),
          eq(asoMonthlyPlans.asoType, input.asoType),
          eq(asoMonthlyPlans.year, input.year),
          eq(asoMonthlyPlans.month, input.month),
          isNull(asoMonthlyPlans.deletedAt),
        ),
      )
      .limit(1);

    if (existing?.frozen) {
      skipped += 1;
      return;
    }

    const preserveManual =
      existing?.executionStatus === "REALIZADO" ||
      existing?.executionStatus === "JUSTIFICADO" ||
      existing?.executionStatus === "DISPENSADO" ||
      existing?.executionStatus === "REPROGRAMADO" ||
      existing?.executionStatus === "AGENDADO";

    let executionStatus: string = preserveManual
      ? existing!.executionStatus
      : elig.eligibility === "JUSTIFICADO"
        ? "JUSTIFICADO"
        : "PREVISTO";
    let alterdataStatus = existing?.alterdataStatus ?? "NAO_APLICAVEL";
    let asoRecordId = existing?.asoRecordId ?? null;

    if (
      input.markRealizedFromAlterdata &&
      !preserveManual &&
      input.alterdataPerformedDate
    ) {
      executionStatus = "REALIZADO";
      alterdataStatus = "CONFIRMADO";
      // Garante registro interno mínimo vinculado ao plano (evita duplicidade operacional)
      if (!asoRecordId) {
        const [created] = await db
          .insert(asoRecords)
          .values({
            employeeId: input.employeeId,
            asoType: input.asoType,
            expectedDate: input.expectedDate,
            performedDate: input.alterdataPerformedDate,
            lastAsoDate: input.alterdataPerformedDate,
            origin: "SYNC",
            regionId: input.regionId,
            unitId: input.unitId,
            planId: existing?.id,
            createdBy: user.id,
            updatedBy: user.id,
          })
          .returning({ id: asoRecords.id });
        asoRecordId = created.id;
      }
    }

    const payload = {
      registration: input.registration,
      employeeName: input.employeeName,
      expectedDate: input.expectedDate,
      regionId: input.regionId,
      unitId: input.unitId,
      regionNameSnapshot: input.regionName,
      unitNameSnapshot: input.unitName,
      functionalStatusSnapshot: input.functionalStatus,
      predictionOrigin: input.origin,
      eligibility: existing?.justificationReason
        ? existing.eligibility
        : elig.eligibility,
      justificationReason:
        existing?.justificationReason || elig.reason || null,
      executionStatus,
      alterdataStatus,
      asoRecordId,
      updatedBy: user.id,
    };

    if (existing) {
      await db
        .update(asoMonthlyPlans)
        .set(payload)
        .where(eq(asoMonthlyPlans.id, existing.id));
      if (asoRecordId && !existing.asoRecordId) {
        await db
          .update(asoRecords)
          .set({ planId: existing.id, updatedBy: user.id })
          .where(eq(asoRecords.id, asoRecordId));
      }
    } else {
      const [created] = await db
        .insert(asoMonthlyPlans)
        .values({
          employeeId: input.employeeId,
          asoType: input.asoType,
          year: input.year,
          month: input.month,
          ...payload,
          createdBy: user.id,
        })
        .returning({ id: asoMonthlyPlans.id });
      if (asoRecordId) {
        await db
          .update(asoRecords)
          .set({ planId: created.id, updatedBy: user.id })
          .where(eq(asoRecords.id, asoRecordId));
      }
    }
    upserted += 1;
  }

  for (const emp of empRows) {
    const snap = snapMap.get(emp.id);
    const trusted = resolveTrustedPeriodicNext({
      admissionDate: emp.admissionDate,
      lastAsoDate: snap?.lastAsoDate ?? null,
      alterdataNextDate: snap?.nextAsoDate ?? null,
      periodicityMonths: snap?.periodicityMonths ?? 12,
    });

    const next = trusted.nextPeriodicDate;
    const ym = yearMonthFromDate(next);
    if (ym && ym.year === year) {
      await upsertPlan({
        employeeId: emp.id,
        registration: emp.registration,
        employeeName: emp.fullName,
        asoType: "PERIODICO",
        year,
        month: ym.month,
        expectedDate: next,
        regionId: emp.regionId,
        unitId: emp.unitId,
        regionName: emp.regionName,
        unitName: emp.unitName,
        functionalStatus: emp.functionalStatus,
        origin:
          trusted.trust === "ALTERDATA"
            ? "ALTERDATA_NEXT_ASO"
            : trusted.trust === "RECOMPUTED_FROM_LAST"
              ? "RECOMPUTED_FROM_LAST_ASO"
              : "RECOMPUTED_FROM_ADMISSION",
      });
    }

    // Remove periódicos órfãos do ano gerados por Proximo_aso inválido
    // (mantém realizados/justificados/agendados/reprogramados).
    const obsolete = await db
      .select({ id: asoMonthlyPlans.id, month: asoMonthlyPlans.month })
      .from(asoMonthlyPlans)
      .where(
        and(
          eq(asoMonthlyPlans.employeeId, emp.id),
          eq(asoMonthlyPlans.asoType, "PERIODICO"),
          eq(asoMonthlyPlans.year, year),
          isNull(asoMonthlyPlans.deletedAt),
          eq(asoMonthlyPlans.frozen, false),
          inArray(asoMonthlyPlans.executionStatus, [
            "PREVISTO",
            "VENCIDO",
            "NAO_REALIZADO",
          ]),
          sql`${asoMonthlyPlans.asoRecordId} is null`,
        ),
      );
    for (const row of obsolete) {
      const keepMonth = ym && ym.year === year ? ym.month : null;
      if (keepMonth != null && row.month === keepMonth) continue;
      // Só limpa origens derivadas do espelho / recálculo automático
      await db
        .update(asoMonthlyPlans)
        .set({ deletedAt: new Date(), updatedBy: user.id })
        .where(
          and(
            eq(asoMonthlyPlans.id, row.id),
            inArray(asoMonthlyPlans.predictionOrigin, [
              "ALTERDATA_NEXT_ASO",
              "RECOMPUTED_FROM_LAST_ASO",
              "RECOMPUTED_FROM_ADMISSION",
            ]),
          ),
        );
      cleaned += 1;
    }

    const adm = yearMonthFromDate(emp.admissionDate);
    if (adm && adm.year === year) {
      await upsertPlan({
        employeeId: emp.id,
        registration: emp.registration,
        employeeName: emp.fullName,
        asoType: "ADMISSIONAL",
        year,
        month: adm.month,
        expectedDate: emp.admissionDate,
        regionId: emp.regionId,
        unitId: emp.unitId,
        regionName: emp.regionName,
        unitName: emp.unitName,
        functionalStatus: emp.functionalStatus,
        origin: "ADMISSION",
        markRealizedFromAlterdata: trusted.admissionAsoEvidence,
        alterdataPerformedDate: snap?.lastAsoDate ?? null,
      });
    }

    const dem = yearMonthFromDate(emp.dismissalDate);
    if (dem && dem.year === year) {
      await upsertPlan({
        employeeId: emp.id,
        registration: emp.registration,
        employeeName: emp.fullName,
        asoType: "DEMISSIONAL",
        year,
        month: dem.month,
        expectedDate: emp.dismissalDate,
        regionId: emp.regionId,
        unitId: emp.unitId,
        regionName: emp.regionName,
        unitName: emp.unitName,
        functionalStatus: emp.functionalStatus,
        origin: "DISMISSAL",
      });
    }
  }

  // Retornos
  const leaves = await db
    .select({
      employeeId: leaveRecords.employeeId,
      expectedReturnDate: leaveRecords.expectedReturnDate,
      actualReturnDate: leaveRecords.actualReturnDate,
    })
    .from(leaveRecords)
    .where(
      and(
        isNull(leaveRecords.deletedAt),
        eq(leaveRecords.requiresReturnAso, true),
      ),
    );

  const empById = new Map(empRows.map((e) => [e.id, e]));
  for (const leave of leaves) {
    const date = leave.actualReturnDate || leave.expectedReturnDate;
    const ym = yearMonthFromDate(date);
    const emp = empById.get(leave.employeeId);
    if (!ym || ym.year !== year || !emp) continue;
    await upsertPlan({
      employeeId: emp.id,
      registration: emp.registration,
      employeeName: emp.fullName,
      asoType: "RETORNO_TRABALHO",
      year,
      month: ym.month,
      expectedDate: date,
      regionId: emp.regionId,
      unitId: emp.unitId,
      regionName: emp.regionName,
      unitName: emp.unitName,
      functionalStatus: emp.functionalStatus,
      origin: "RETURN",
    });
  }

  return { upserted, skipped, cleaned, year };
}

/** Atualiza alterdataStatus dos planos abertos com realização. */
export async function refreshPlanAlterdataStatuses(limit = 5000) {
  const db = getDb();
  const plans = await db
    .select({
      id: asoMonthlyPlans.id,
      employeeId: asoMonthlyPlans.employeeId,
      asoRecordId: asoMonthlyPlans.asoRecordId,
      frozen: asoMonthlyPlans.frozen,
      performedDate: asoRecords.performedDate,
      periodicityMonths: asoRecords.periodicityMonths,
    })
    .from(asoMonthlyPlans)
    .leftJoin(asoRecords, eq(asoMonthlyPlans.asoRecordId, asoRecords.id))
    .where(
      and(
        isNull(asoMonthlyPlans.deletedAt),
        eq(asoMonthlyPlans.frozen, false),
        sql`${asoMonthlyPlans.asoRecordId} is not null`,
      ),
    )
    .limit(limit);

  if (!plans.length) return { updated: 0 };

  const employeeIds = [...new Set(plans.map((p) => p.employeeId))];
  const snapsByEmployee = new Map<
    string,
    Array<{ nextAsoDate: string | null; syncedAt: Date }>
  >();

  const CHUNK_IN = 400;
  for (let i = 0; i < employeeIds.length; i += CHUNK_IN) {
    const chunk = employeeIds.slice(i, i + CHUNK_IN);
    const snaps = await db
      .select({
        employeeId: asoAlterdataSnapshots.employeeId,
        nextAsoDate: asoAlterdataSnapshots.nextAsoDate,
        syncedAt: asoAlterdataSnapshots.syncedAt,
      })
      .from(asoAlterdataSnapshots)
      .where(inArray(asoAlterdataSnapshots.employeeId, chunk))
      .orderBy(
        asoAlterdataSnapshots.employeeId,
        asoAlterdataSnapshots.syncedAt,
      );

    for (const s of snaps) {
      const list = snapsByEmployee.get(s.employeeId) ?? [];
      list.push({ nextAsoDate: s.nextAsoDate, syncedAt: s.syncedAt });
      if (list.length > 20) list.shift();
      snapsByEmployee.set(s.employeeId, list);
    }
  }

  const updates: Array<{ id: string; status: string }> = [];
  for (const plan of plans) {
    const snaps = snapsByEmployee.get(plan.employeeId) ?? [];
    const status = reconcileAlterdataStatus({
      performedDate: plan.performedDate,
      periodicityMonths: plan.periodicityMonths,
      snapshots: snaps.map((s) => ({
        nextAsoDate: s.nextAsoDate,
        syncedAt: s.syncedAt,
      })),
    });
    updates.push({ id: plan.id, status });
  }

  const CHUNK_UPD = 40;
  for (let i = 0; i < updates.length; i += CHUNK_UPD) {
    const chunk = updates.slice(i, i + CHUNK_UPD);
    await Promise.all(
      chunk.map((u) =>
        db
          .update(asoMonthlyPlans)
          .set({ alterdataStatus: u.status })
          .where(eq(asoMonthlyPlans.id, u.id)),
      ),
    );
  }

  return { updated: updates.length };
}
