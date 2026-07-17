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
  dismissedBeforeCompetence,
  dismissedBeforeYear,
  eligibilityFromFunctionalStatus,
  yearMonthFromDate,
} from "@/lib/aso/planning";
import { resolveTrustedPeriodicNext } from "@/lib/aso/prediction";
import {
  isOpenWorkload,
  isPlanOverdue,
} from "@/lib/aso/execution";
import { reconcileAlterdataStatus } from "@/lib/aso/reconciliation";
import { humanizeLabel, formatUnitDisplayName } from "@/lib/labels";
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
  const asoType = params.type || "PERIODICO";
  const mode = params.mode === "accumulated" ? "accumulated" : "monthly";
  const scoped = clampScope(
    user,
    params.regionId || "",
    params.unitId || "",
  );
  let regionId = scoped.regionId;
  const unitId = scoped.unitId;

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

  // Datas do espelho: muitos planos ficam REALIZADO/CONFIRMADO sem aso_record.
  // Sem isso, "Data realizada" / "Próximo ASO" saem vazios no detalhe.
  const registrations = [...new Set(planRows.map((p) => p.registration))];
  const snapByReg = new Map<
    string,
    { lastAsoDate: string | null; nextAsoDate: string | null }
  >();
  if (registrations.length) {
    const snapRows = await db
      .select({
        registration: asoAlterdataSnapshots.registration,
        lastAsoDate: asoAlterdataSnapshots.lastAsoDate,
        nextAsoDate: asoAlterdataSnapshots.nextAsoDate,
        syncedAt: asoAlterdataSnapshots.syncedAt,
      })
      .from(asoAlterdataSnapshots)
      .where(inArray(asoAlterdataSnapshots.registration, registrations))
      .orderBy(desc(asoAlterdataSnapshots.syncedAt));
    for (const s of snapRows) {
      if (snapByReg.has(s.registration)) continue;
      snapByReg.set(s.registration, {
        lastAsoDate: s.lastAsoDate ? String(s.lastAsoDate).slice(0, 10) : null,
        nextAsoDate: s.nextAsoDate ? String(s.nextAsoDate).slice(0, 10) : null,
      });
    }
  }

  const enrichedPlanRows = planRows.map((p) => {
    const snap = snapByReg.get(p.registration);
    const realized =
      p.executionStatus === "REALIZADO" ||
      Boolean(p.asoRecordId) ||
      p.alterdataStatus === "CONFIRMADO";
    const performedDate =
      (p.performedDate ? String(p.performedDate).slice(0, 10) : null) ??
      (realized ? (snap?.lastAsoDate ?? null) : null);
    const nextAsoDate =
      (p.nextAsoDate ? String(p.nextAsoDate).slice(0, 10) : null) ??
      snap?.nextAsoDate ??
      null;
    return {
      ...p,
      performedDate,
      nextAsoDate,
      expectedDate: p.expectedDate
        ? String(p.expectedDate).slice(0, 10)
        : null,
    };
  });

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
    enrichedPlanRows.map((p) => ({
      eligibility: p.eligibility,
      executionStatus: p.executionStatus,
      alterdataStatus: p.alterdataStatus,
      expectedDate: p.expectedDate,
      asoRecordId: p.asoRecordId,
      performedDate: p.performedDate,
      justificationReason: p.justificationReason,
      functionalStatusSnapshot: p.functionalStatusSnapshot,
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
  let matrixUnitCount = 0;

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
  } else if (unitId) {
    // Unidade selecionada: só a linha da unidade (visão detalhada)
    const subset = yearPlans.filter((p) => p.unitId === unitId);
    const label =
      unitRows.find((u) => u.id === unitId)?.name ||
      subset[0]?.unitName ||
      "Unidade";
    matrixRows.push({
      key: unitId,
      label: formatUnitDisplayName(label),
      regionId: regionId || null,
      unitId,
      cells: buildCells(subset, regionId || null, unitId),
    });
    matrixUnitCount = 1;
  } else {
    // Regional sem unidade: só o consolidado da regional (sem listar dezenas de unidades)
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
    matrixUnitCount = unitRows.length;
  }

  // Relação nominal filtrada (competência atual)
  let nominal = enrichedPlanRows;
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
    nominal = nominal.filter((p) =>
      isOpenWorkload({
        eligibility: p.eligibility,
        executionStatus: p.executionStatus,
        expectedDate: p.expectedDate,
        asoRecordId: p.asoRecordId,
        performedDate: p.performedDate,
      }),
    );
  }
  if (params.divergencesOnly === "1") {
    nominal = nominal.filter((p) => p.alterdataStatus === "DIVERGENCIA_DATA");
  }
  if (params.overdueOnly === "1") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
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
      const subset = enrichedPlanRows.filter((p) => p.regionId === reg.id);
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
    matrixUnitCount,
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
      statusAso: asoAlterdataSnapshots.statusAso,
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
      statusAso: string | null;
      periodicityMonths: number | null;
    }
  >();
  for (const r of snapRows) {
    if (!snapMap.has(r.employeeId)) {
      snapMap.set(r.employeeId, {
        nextAsoDate: r.nextAsoDate,
        lastAsoDate: r.lastAsoDate,
        statusAso: r.statusAso,
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
        statusAso: null,
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
    /** Ultimo_aso do espelho — usado para não preservar REALIZADO fantasma. */
    alterdataLastAsoDate?: string | null;
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

    const leaveReason =
      elig.reason === "AFASTADO" || elig.reason === "FERIAS"
        ? elig.reason
        : null;

    // Afastado/férias: plano permanece no mês, mas sai da meta (JUSTIFICADO),
    // exceto se já estiver REALIZADO (cumprimento histórico da competência).
    // Demitido NÃO usa justificativa: quem saiu antes da competência some do plano.
    const returningFromLeave =
      elig.eligibility === "ELEGIVEL" &&
      existing?.executionStatus === "JUSTIFICADO" &&
      (existing.justificationReason === "AFASTADO" ||
        existing.justificationReason === "FERIAS");

    const alreadyRealized = existing?.executionStatus === "REALIZADO";
    const forceLeaveOutOfMeta = Boolean(leaveReason) && !alreadyRealized;

    // Demissional não usa justificativa "DEMITIDO" — a demissão É o motivo do exame.
    const spuriousDemissionalJustify =
      input.asoType === "DEMISSIONAL" &&
      existing?.executionStatus === "JUSTIFICADO" &&
      existing?.justificationReason === "DEMITIDO";

    // Periódico "REALIZADO" sem atestado na competência (ex.: planilha ASO_2026
    // marcou performed em linha futura) não deve ser preservado.
    const lastAsoIso = input.alterdataLastAsoDate
      ? String(input.alterdataLastAsoDate).slice(0, 10)
      : null;
    const expectedIso = input.expectedDate
      ? String(input.expectedDate).slice(0, 10)
      : null;
    const lastYm = yearMonthFromDate(lastAsoIso);
    const periodicoRealizedSupported =
      Boolean(lastAsoIso) &&
      ((expectedIso != null && lastAsoIso! >= expectedIso) ||
        Boolean(
          lastYm && lastYm.year === input.year && lastYm.month === input.month,
        ));
    const spuriousPeriodicoRealized =
      input.asoType === "PERIODICO" &&
      existing?.executionStatus === "REALIZADO" &&
      !periodicoRealizedSupported;

    const preserveManual =
      !forceLeaveOutOfMeta &&
      !returningFromLeave &&
      !spuriousDemissionalJustify &&
      !spuriousPeriodicoRealized &&
      (existing?.executionStatus === "REALIZADO" ||
        existing?.executionStatus === "JUSTIFICADO" ||
        existing?.executionStatus === "DISPENSADO" ||
        existing?.executionStatus === "REPROGRAMADO" ||
        existing?.executionStatus === "AGENDADO");

    let executionStatus: string;
    if (forceLeaveOutOfMeta) {
      executionStatus = "JUSTIFICADO";
    } else if (spuriousPeriodicoRealized) {
      executionStatus = "PREVISTO";
    } else if (preserveManual) {
      executionStatus = existing!.executionStatus;
    } else if (returningFromLeave || spuriousDemissionalJustify) {
      executionStatus = "PREVISTO";
    } else {
      executionStatus =
        elig.eligibility === "JUSTIFICADO" ? "JUSTIFICADO" : "PREVISTO";
    }

    let alterdataStatus = existing?.alterdataStatus ?? "NAO_APLICAVEL";
    let asoRecordId = existing?.asoRecordId ?? null;

    if (spuriousPeriodicoRealized) {
      alterdataStatus = "NAO_APLICAVEL";
      asoRecordId = null;
    }

    if (
      input.markRealizedFromAlterdata &&
      !preserveManual &&
      !forceLeaveOutOfMeta &&
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

    const justificationReason = forceLeaveOutOfMeta
      ? leaveReason
      : returningFromLeave || spuriousDemissionalJustify
        ? null
        : leaveReason && alreadyRealized
          ? leaveReason
          : existing?.justificationReason || elig.reason || null;

    const eligibility = forceLeaveOutOfMeta
      ? "JUSTIFICADO"
      : returningFromLeave || spuriousDemissionalJustify
        ? "ELEGIVEL"
        : existing?.justificationReason && !leaveReason
          ? existing.eligibility
          : leaveReason && alreadyRealized
            ? existing?.eligibility || "ELEGIVEL"
            : elig.eligibility;

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
      eligibility,
      justificationReason,
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
    // Demitido antes do ano: não gera nada e remove fantasmas do ano.
    if (dismissedBeforeYear(emp.dismissalDate, year)) {
      const ghosts = await db
        .select({ id: asoMonthlyPlans.id })
        .from(asoMonthlyPlans)
        .where(
          and(
            eq(asoMonthlyPlans.employeeId, emp.id),
            eq(asoMonthlyPlans.year, year),
            isNull(asoMonthlyPlans.deletedAt),
            eq(asoMonthlyPlans.frozen, false),
          ),
        );
      for (const g of ghosts) {
        await db
          .update(asoMonthlyPlans)
          .set({ deletedAt: new Date(), updatedBy: user.id })
          .where(eq(asoMonthlyPlans.id, g.id));
        cleaned += 1;
      }
      continue;
    }

    const snap = snapMap.get(emp.id);
    const trusted = resolveTrustedPeriodicNext({
      admissionDate: emp.admissionDate,
      lastAsoDate: snap?.lastAsoDate ?? null,
      alterdataNextDate: snap?.nextAsoDate ?? null,
      periodicityMonths: snap?.periodicityMonths ?? 12,
    });

    const next = trusted.nextPeriodicDate;
    const ym = yearMonthFromDate(next);
    const demYm = yearMonthFromDate(emp.dismissalDate);
    const periodicAllowed =
      Boolean(ym) &&
      ym!.year === year &&
      !dismissedBeforeCompetence(emp.dismissalDate, ym!.year, ym!.month) &&
      !(emp.dismissalDate && next && next > emp.dismissalDate) &&
      // No mês da demissão o ASO é DEMISSIONAL, não periódico.
      !(demYm && demYm.year === ym!.year && demYm.month === ym!.month);

    if (periodicAllowed && ym) {
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
        alterdataLastAsoDate: snap?.lastAsoDate
          ? String(snap.lastAsoDate).slice(0, 10)
          : null,
      });
    }

    // Remove periódicos órfãos / fantasmas (demissão, mês errado, next já em outro ano).
    const obsolete = await db
      .select({
        id: asoMonthlyPlans.id,
        month: asoMonthlyPlans.month,
        executionStatus: asoMonthlyPlans.executionStatus,
        justificationReason: asoMonthlyPlans.justificationReason,
        predictionOrigin: asoMonthlyPlans.predictionOrigin,
      })
      .from(asoMonthlyPlans)
      .where(
        and(
          eq(asoMonthlyPlans.employeeId, emp.id),
          eq(asoMonthlyPlans.asoType, "PERIODICO"),
          eq(asoMonthlyPlans.year, year),
          isNull(asoMonthlyPlans.deletedAt),
          eq(asoMonthlyPlans.frozen, false),
        ),
      );
    for (const row of obsolete) {
      const keepMonth =
        periodicAllowed && ym && ym.year === year ? ym.month : null;
      const isGhostDismissed =
        row.justificationReason === "DEMITIDO" ||
        dismissedBeforeCompetence(emp.dismissalDate, year, row.month);
      // Next confiável fora do ano/mês → plano fantasma (ex.: ASO 2026 em out com next em 2027)
      const isStaleVsAlterdata =
        keepMonth == null || row.month !== keepMonth;
      const isRealized = String(row.executionStatus || "") === "REALIZADO";
      const now = new Date();
      const currentMonth =
        now.getFullYear() === year
          ? now.getMonth() + 1
          : now.getFullYear() > year
            ? 12
            : 0;
      // REALIZADO em competência passada/atual = histórico de aderência.
      // Não apagar só porque o Proximo_aso já foi para o ano seguinte.
      if (isRealized && row.month <= currentMonth && !isGhostDismissed) {
        continue;
      }
      const isOpenStatus = [
        "PREVISTO",
        "VENCIDO",
        "NAO_REALIZADO",
        "JUSTIFICADO",
        "REALIZADO",
      ].includes(String(row.executionStatus || ""));
      if (keepMonth != null && row.month === keepMonth && !isGhostDismissed) {
        continue;
      }
      if (!isOpenStatus && !isGhostDismissed) continue;
      if (
        !isGhostDismissed &&
        !isStaleVsAlterdata &&
        ![
          "ALTERDATA_NEXT_ASO",
          "RECOMPUTED_FROM_LAST_ASO",
          "RECOMPUTED_FROM_ADMISSION",
          "MIGRATION",
          "ASO_2026_CONTROL",
        ].includes(String(row.predictionOrigin || ""))
      ) {
        continue;
      }
      // Fantasma futuro (mês > atual) ou aberto fora do next: remove.
      if (!isGhostDismissed && !isStaleVsAlterdata) {
        continue;
      }
      await db
        .update(asoMonthlyPlans)
        .set({ deletedAt: new Date(), updatedBy: user.id })
        .where(eq(asoMonthlyPlans.id, row.id));
      cleaned += 1;
    }

    const adm = yearMonthFromDate(emp.admissionDate);
    if (adm && adm.year === year) {
      const lastIso = snap?.lastAsoDate
        ? String(snap.lastAsoDate).slice(0, 10)
        : null;
      const admIso = emp.admissionDate
        ? String(emp.admissionDate).slice(0, 10)
        : null;
      const lastAfterAdmission =
        Boolean(lastIso && admIso && lastIso >= admIso);
      const performedFromAlterdata = trusted.admissionAsoEvidence
        ? lastAfterAdmission
          ? lastIso
          : admIso
        : null;

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
        alterdataPerformedDate: performedFromAlterdata,
      });

      // Competência do admissional = mês da admissão. Remove duplicatas
      // (ex.: migração pelo Data_Atestado em outro mês).
      const wrongAdm = await db
        .select({
          id: asoMonthlyPlans.id,
          month: asoMonthlyPlans.month,
        })
        .from(asoMonthlyPlans)
        .where(
          and(
            eq(asoMonthlyPlans.employeeId, emp.id),
            eq(asoMonthlyPlans.asoType, "ADMISSIONAL"),
            eq(asoMonthlyPlans.year, year),
            isNull(asoMonthlyPlans.deletedAt),
            eq(asoMonthlyPlans.frozen, false),
          ),
        );
      for (const row of wrongAdm) {
        if (row.month === adm.month) continue;
        await db
          .update(asoMonthlyPlans)
          .set({ deletedAt: new Date(), updatedBy: user.id })
          .where(eq(asoMonthlyPlans.id, row.id));
        cleaned += 1;
      }
    } else {
      // Sem admissão neste ano: não deve haver admissional na competência.
      const strayAdm = await db
        .select({ id: asoMonthlyPlans.id })
        .from(asoMonthlyPlans)
        .where(
          and(
            eq(asoMonthlyPlans.employeeId, emp.id),
            eq(asoMonthlyPlans.asoType, "ADMISSIONAL"),
            eq(asoMonthlyPlans.year, year),
            isNull(asoMonthlyPlans.deletedAt),
            eq(asoMonthlyPlans.frozen, false),
          ),
        );
      for (const row of strayAdm) {
        await db
          .update(asoMonthlyPlans)
          .set({ deletedAt: new Date(), updatedBy: user.id })
          .where(eq(asoMonthlyPlans.id, row.id));
        cleaned += 1;
      }
    }

    const dem = yearMonthFromDate(emp.dismissalDate);
    if (dem && dem.year === year) {
      // Remove demissionais fantasmas em mês/ano diferente da demissão atual.
      const wrongDem = await db
        .select({
          id: asoMonthlyPlans.id,
          month: asoMonthlyPlans.month,
          year: asoMonthlyPlans.year,
        })
        .from(asoMonthlyPlans)
        .where(
          and(
            eq(asoMonthlyPlans.employeeId, emp.id),
            eq(asoMonthlyPlans.asoType, "DEMISSIONAL"),
            isNull(asoMonthlyPlans.deletedAt),
            eq(asoMonthlyPlans.frozen, false),
          ),
        );
      for (const row of wrongDem) {
        if (row.year === dem.year && row.month === dem.month) continue;
        await db
          .update(asoMonthlyPlans)
          .set({ deletedAt: new Date(), updatedBy: user.id })
          .where(eq(asoMonthlyPlans.id, row.id));
        cleaned += 1;
      }

      const lastIso = snap?.lastAsoDate
        ? String(snap.lastAsoDate).slice(0, 10)
        : null;
      const demIso = emp.dismissalDate
        ? String(emp.dismissalDate).slice(0, 10)
        : null;
      const statusAso = String(snap?.statusAso || "")
        .trim()
        .toUpperCase();
      // Evidência de demissional no Alterdata:
      // 1) Data_Atestado ≥ demissão, ou
      // 2) Status_ASO = DEMITIDO (ciclo ocupacional encerrado no espelho)
      const demissionalDone = Boolean(
        demIso &&
          ((lastIso && lastIso >= demIso) || statusAso === "DEMITIDO"),
      );
      const performedFromAlterdata = demissionalDone
        ? lastIso && demIso && lastIso >= demIso
          ? lastIso
          : demIso
        : null;

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
        markRealizedFromAlterdata: demissionalDone,
        alterdataPerformedDate: performedFromAlterdata,
      });
    } else if (emp.dismissalDate) {
      // Demissão fora do ano: limpa demissionais do ano de planejamento.
      const wrongDem = await db
        .select({ id: asoMonthlyPlans.id })
        .from(asoMonthlyPlans)
        .where(
          and(
            eq(asoMonthlyPlans.employeeId, emp.id),
            eq(asoMonthlyPlans.asoType, "DEMISSIONAL"),
            eq(asoMonthlyPlans.year, year),
            isNull(asoMonthlyPlans.deletedAt),
            eq(asoMonthlyPlans.frozen, false),
          ),
        );
      for (const row of wrongDem) {
        await db
          .update(asoMonthlyPlans)
          .set({ deletedAt: new Date(), updatedBy: user.id })
          .where(eq(asoMonthlyPlans.id, row.id));
        cleaned += 1;
      }
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
