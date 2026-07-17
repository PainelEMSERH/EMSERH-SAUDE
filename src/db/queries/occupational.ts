import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "@/db";
import {
  appointments,
  asoAlterdataSnapshots,
  asoRecords,
  biologicalAccidentFollowups,
  biologicalAccidents,
  employeeVaccinations,
  employees,
  leaveRecords,
  physicians,
  pregnancyCases,
  regions,
  units,
  vaccines,
} from "@/db/schemas";
import { calcLeaveDays } from "@/lib/dates";
import {
  leaveTypesForTab,
  resolveLeaveTab,
  type LeaveTabValue,
} from "@/lib/leaves/constants";
import { resolveLeaveReturnInfo } from "@/lib/leaves/status";
import {
  parseVaccinationNotes,
  summarizeVaccinationKit,
} from "@/lib/vaccination/constants";
import {
  resolveFollowupDisplay,
  summarizeFollowups,
  type BioFollowupView,
} from "@/lib/biological/constants";
import {
  employeeScopeCondition,
  parsePage,
  parsePageSize,
  type ListResult,
} from "@/lib/scope";
import type { SessionUser } from "@/types";

function empJoinScope(user: SessionUser) {
  return employeeScopeCondition(user);
}

export async function listAsos(
  user: SessionUser,
  params: { q?: string; status?: string; type?: string; page?: string },
): Promise<
  ListResult<{
    id: string;
    registration: string;
    fullName: string;
    asoType: string;
    nextAsoDate: string | null;
    deadlineStatus: string | null;
    result: string | null;
    unitName: string | null;
  }>
> {
  const page = parsePage(params.page);
  const pageSize = parsePageSize(undefined);
  const db = getDb();
  const scope = empJoinScope(user);
  const where = and(
    isNull(asoRecords.deletedAt),
    isNull(employees.deletedAt),
    scope,
    params.status && params.status !== "ALL"
      ? eq(asoRecords.deadlineStatus, params.status)
      : undefined,
    params.type && params.type !== "ALL"
      ? eq(asoRecords.asoType, params.type)
      : undefined,
    params.q
      ? or(
          ilike(employees.fullName, `%${params.q}%`),
          ilike(employees.registration, `%${params.q}%`),
        )
      : undefined,
  );

  const [totalRow] = await db
    .select({ value: count() })
    .from(asoRecords)
    .innerJoin(employees, eq(asoRecords.employeeId, employees.id))
    .where(where);

  const rows = await db
    .select({
      id: asoRecords.id,
      registration: employees.registration,
      fullName: employees.fullName,
      asoType: asoRecords.asoType,
      nextAsoDate: asoRecords.nextAsoDate,
      deadlineStatus: asoRecords.deadlineStatus,
      result: asoRecords.result,
      unitName: units.name,
    })
    .from(asoRecords)
    .innerJoin(employees, eq(asoRecords.employeeId, employees.id))
    .leftJoin(units, eq(asoRecords.unitId, units.id))
    .where(where)
    .orderBy(desc(asoRecords.nextAsoDate))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const total = totalRow?.value ?? 0;
  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listAppointments(
  user: SessionUser,
  params: { q?: string; status?: string; page?: string },
) {
  const page = parsePage(params.page);
  const pageSize = parsePageSize(undefined);
  const db = getDb();
  const scope = empJoinScope(user);
  const where = and(
    isNull(appointments.deletedAt),
    isNull(employees.deletedAt),
    scope,
    params.status && params.status !== "ALL"
      ? eq(appointments.presenceStatus, params.status)
      : undefined,
    params.q
      ? or(
          ilike(employees.fullName, `%${params.q}%`),
          ilike(employees.registration, `%${params.q}%`),
        )
      : undefined,
  );

  const [totalRow] = await db
    .select({ value: count() })
    .from(appointments)
    .innerJoin(employees, eq(appointments.employeeId, employees.id))
    .where(where);

  const rows = await db
    .select({
      id: appointments.id,
      registration: employees.registration,
      fullName: employees.fullName,
      appointmentType: appointments.appointmentType,
      scheduledAt: appointments.scheduledAt,
      presenceStatus: appointments.presenceStatus,
      conduct: appointments.conduct,
      result: appointments.result,
      physicianName: physicians.name,
    })
    .from(appointments)
    .innerJoin(employees, eq(appointments.employeeId, employees.id))
    .leftJoin(physicians, eq(appointments.physicianId, physicians.id))
    .where(where)
    .orderBy(desc(appointments.scheduledAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const total = totalRow?.value ?? 0;
  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type LeavesListParams = {
  q?: string;
  status?: string;
  /** Aba: doenca | licencas | atestados | ALL */
  group?: string;
  /** Tipo exato do Alterdata (opcional, refina a aba) */
  leaveType?: string;
  returnPending?: string;
  page?: string;
};

export type LeaveListRow = {
  id: string;
  employeeId: string;
  registration: string;
  fullName: string;
  unitName: string | null;
  regionName: string | null;
  leaveType: string;
  startDate: string;
  endDate: string | null;
  daysCount: number | null;
  /** Status persistido no banco. */
  status: string;
  /** Status operacional (período encerrado / retorno ASO). */
  displayStatus: "ATIVO" | "ENCERRADO";
  cidCode: string | null;
  reasonSimplified: string | null;
  reason: string | null;
  expectedReturnDate: string | null;
  actualReturnDate: string | null;
  requiresReturnAso: boolean;
  notes: string | null;
  lastAsoDate: string | null;
  returnLabel: string;
  returnTone: "ok" | "warn" | "danger" | "muted";
  returnDone: boolean;
};

export type LeavesMetrics = {
  total: number;
  ativos: number;
  encerrados: number;
  retornoPendente: number;
  doenca: number;
  licencas: number;
  atestados: number;
  diasAtivos: number;
};

export type LeavesTabCounts = {
  doenca: number;
  licencas: number;
  atestados: number;
  ALL: number;
};

export async function listLeaves(
  user: SessionUser,
  params: LeavesListParams,
  options?: { includeClinical?: boolean },
) {
  const page = parsePage(params.page);
  const pageSize = parsePageSize(undefined);
  const db = getDb();
  const scope = empJoinScope(user);
  const includeClinical = options?.includeClinical === true;

  const tab = resolveLeaveTab(
    params.group ?? (params.leaveType ? "ALL" : undefined),
  );
  const tabTypes = leaveTypesForTab(tab);

  const typeFilter =
    params.leaveType && params.leaveType !== "ALL"
      ? eq(leaveRecords.leaveType, params.leaveType)
      : tabTypes
        ? inArray(leaveRecords.leaveType, tabTypes)
        : undefined;

  const scopeWhere = and(
    isNull(leaveRecords.deletedAt),
    isNull(employees.deletedAt),
    scope,
    params.q
      ? or(
          ilike(employees.fullName, `%${params.q}%`),
          ilike(employees.registration, `%${params.q}%`),
        )
      : undefined,
  );

  const baseWhere = and(scopeWhere, typeFilter);

  const listWhere = and(
    baseWhere,
    params.status === "ATIVO"
      ? and(
          eq(leaveRecords.status, "ATIVO"),
          sql`(${leaveRecords.endDate} is null or ${leaveRecords.endDate}::date >= current_date)`,
          isNull(leaveRecords.actualReturnDate),
        )
      : params.status === "ENCERRADO"
        ? or(
            eq(leaveRecords.status, "ENCERRADO"),
            sql`${leaveRecords.endDate} is not null and ${leaveRecords.endDate}::date < current_date`,
            sql`${leaveRecords.actualReturnDate} is not null`,
          )
        : params.status && params.status !== "ALL"
          ? eq(leaveRecords.status, params.status)
          : undefined,
    params.returnPending === "1"
      ? and(
          or(
            eq(leaveRecords.requiresReturnAso, true),
            sql`${leaveRecords.leaveType} like '01%'`,
          ),
          isNull(leaveRecords.actualReturnDate),
          sql`${leaveRecords.endDate} is not null and ${leaveRecords.endDate}::date < current_date`,
        )
      : undefined,
  );

  const [totalRow] = await db
    .select({ value: count() })
    .from(leaveRecords)
    .innerJoin(employees, eq(leaveRecords.employeeId, employees.id))
    .where(listWhere);

  const [metricsRow] = await db
    .select({
      total: count(),
      ativos: sql<number>`count(*) filter (
        where ${leaveRecords.status} = 'ATIVO'
          and (${leaveRecords.endDate} is null or ${leaveRecords.endDate}::date >= current_date)
          and ${leaveRecords.actualReturnDate} is null
      )`.mapWith(Number),
      encerrados: sql<number>`count(*) filter (
        where ${leaveRecords.status} = 'ENCERRADO'
          or (${leaveRecords.endDate} is not null and ${leaveRecords.endDate}::date < current_date)
          or ${leaveRecords.actualReturnDate} is not null
      )`.mapWith(Number),
      retornoPendente: sql<number>`count(*) filter (
        where (
          ${leaveRecords.requiresReturnAso} = true
          or ${leaveRecords.leaveType} like '01%'
        )
          and ${leaveRecords.actualReturnDate} is null
          and ${leaveRecords.endDate} is not null
          and ${leaveRecords.endDate}::date < current_date
      )`.mapWith(Number),
      doenca: sql<number>`count(*) filter (
        where ${leaveRecords.leaveType} = '01 - Afast. por motivo de doen'
      )`.mapWith(Number),
      licencas: sql<number>`count(*) filter (
        where ${leaveRecords.leaveType} in (
          '03 - Licença Maternidade',
          '11 - Prorrog. Maternidade Lei'
        )
      )`.mapWith(Number),
      atestados: sql<number>`count(*) filter (
        where ${leaveRecords.leaveType} = '10 - Atestados'
      )`.mapWith(Number),
      diasAtivos: sql<number>`coalesce(
        sum(
          case
            when ${leaveRecords.status} = 'ATIVO'
              and (${leaveRecords.endDate} is null or ${leaveRecords.endDate}::date >= current_date)
              and ${leaveRecords.actualReturnDate} is null
              and ${leaveRecords.daysCount} is not null
              then ${leaveRecords.daysCount}
            when ${leaveRecords.status} = 'ATIVO'
              and (${leaveRecords.endDate} is null or ${leaveRecords.endDate}::date >= current_date)
              and ${leaveRecords.actualReturnDate} is null
              and ${leaveRecords.startDate} is not null
              and ${leaveRecords.endDate} is not null
              then (${leaveRecords.endDate}::date - ${leaveRecords.startDate}::date) + 1
            else 0
          end
        ),
        0
      )`.mapWith(Number),
    })
    .from(leaveRecords)
    .innerJoin(employees, eq(leaveRecords.employeeId, employees.id))
    .where(baseWhere);

  // Contagens das abas (respeitam busca, ignoram aba/tipo atual)
  const [tabCountsRow] = await db
    .select({
      ALL: count(),
      doenca: sql<number>`count(*) filter (
        where ${leaveRecords.leaveType} = '01 - Afast. por motivo de doen'
      )`.mapWith(Number),
      licencas: sql<number>`count(*) filter (
        where ${leaveRecords.leaveType} in (
          '03 - Licença Maternidade',
          '11 - Prorrog. Maternidade Lei'
        )
      )`.mapWith(Number),
      atestados: sql<number>`count(*) filter (
        where ${leaveRecords.leaveType} = '10 - Atestados'
      )`.mapWith(Number),
    })
    .from(leaveRecords)
    .innerJoin(employees, eq(leaveRecords.employeeId, employees.id))
    .where(scopeWhere);

  const rows = await db
    .select({
      id: leaveRecords.id,
      employeeId: leaveRecords.employeeId,
      registration: employees.registration,
      fullName: employees.fullName,
      unitName: units.name,
      regionName: regions.name,
      leaveType: leaveRecords.leaveType,
      startDate: leaveRecords.startDate,
      endDate: leaveRecords.endDate,
      daysCount: leaveRecords.daysCount,
      status: leaveRecords.status,
      cidCode: includeClinical ? leaveRecords.cidCode : sql<string | null>`null`,
      reasonSimplified: leaveRecords.reasonSimplified,
      reason: leaveRecords.reason,
      expectedReturnDate: leaveRecords.expectedReturnDate,
      actualReturnDate: leaveRecords.actualReturnDate,
      requiresReturnAso: leaveRecords.requiresReturnAso,
      notes: leaveRecords.notes,
    })
    .from(leaveRecords)
    .innerJoin(employees, eq(leaveRecords.employeeId, employees.id))
    .leftJoin(units, eq(employees.unitId, units.id))
    .leftJoin(regions, eq(employees.regionId, regions.id))
    .where(listWhere)
    .orderBy(desc(leaveRecords.startDate))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const total = totalRow?.value ?? 0;
  const metrics: LeavesMetrics = {
    total: metricsRow?.total ?? 0,
    ativos: metricsRow?.ativos ?? 0,
    encerrados: metricsRow?.encerrados ?? 0,
    retornoPendente: metricsRow?.retornoPendente ?? 0,
    doenca: metricsRow?.doenca ?? 0,
    licencas: metricsRow?.licencas ?? 0,
    atestados: metricsRow?.atestados ?? 0,
    diasAtivos: metricsRow?.diasAtivos ?? 0,
  };

  const tabCounts: LeavesTabCounts = {
    doenca: tabCountsRow?.doenca ?? 0,
    licencas: tabCountsRow?.licencas ?? 0,
    atestados: tabCountsRow?.atestados ?? 0,
    ALL: tabCountsRow?.ALL ?? 0,
  };

  const regs = [...new Set(rows.map((r) => r.registration))];
  const snapByReg = new Map<string, string | null>();
  if (regs.length) {
    const snapRows = await db
      .select({
        registration: asoAlterdataSnapshots.registration,
        lastAsoDate: asoAlterdataSnapshots.lastAsoDate,
        syncedAt: asoAlterdataSnapshots.syncedAt,
      })
      .from(asoAlterdataSnapshots)
      .where(inArray(asoAlterdataSnapshots.registration, regs))
      .orderBy(desc(asoAlterdataSnapshots.syncedAt));
    for (const s of snapRows) {
      if (snapByReg.has(s.registration)) continue;
      snapByReg.set(
        s.registration,
        s.lastAsoDate ? String(s.lastAsoDate).slice(0, 10) : null,
      );
    }
  }

  return {
    rows: rows.map((r) => {
      const startDate = r.startDate ? String(r.startDate).slice(0, 10) : "";
      const endDate = r.endDate ? String(r.endDate).slice(0, 10) : null;
      let daysCount = r.daysCount;
      if (daysCount == null && startDate && endDate) {
        daysCount = calcLeaveDays(
          new Date(`${startDate}T12:00:00`),
          new Date(`${endDate}T12:00:00`),
        );
      }
      const lastAsoDate = snapByReg.get(r.registration) ?? null;
      const info = resolveLeaveReturnInfo({
        leaveType: r.leaveType,
        status: r.status,
        startDate,
        endDate,
        actualReturnDate: r.actualReturnDate
          ? String(r.actualReturnDate).slice(0, 10)
          : null,
        requiresReturnAso: r.requiresReturnAso,
        lastAsoDate,
      });
      return {
        ...r,
        cidCode: includeClinical ? r.cidCode : null,
        startDate,
        endDate,
        daysCount,
        expectedReturnDate: r.expectedReturnDate
          ? String(r.expectedReturnDate).slice(0, 10)
          : null,
        actualReturnDate: r.actualReturnDate
          ? String(r.actualReturnDate).slice(0, 10)
          : null,
        displayStatus: info.displayStatus,
        lastAsoDate: info.lastAsoDate,
        returnLabel: info.returnLabel,
        returnTone: info.returnTone,
        returnDone: info.returnDone,
      };
    }) satisfies LeaveListRow[],
    metrics,
    tabCounts,
    group: tab as LeaveTabValue,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type VaccinationListParams = {
  q?: string;
  /** complete | incomplete | attention | refusal */
  kit?: string;
  page?: string;
};

export type VaccinationListRow = {
  id: string;
  employeeId: string;
  registration: string;
  fullName: string;
  unitName: string | null;
  regionName: string | null;
  situations: Record<string, string>;
  kit: ReturnType<typeof summarizeVaccinationKit>;
};

export type VaccinationMetrics = {
  total: number;
  kitComplete: number;
  incomplete: number;
  withRefusal: number;
  attention: number;
};

export async function listVaccinations(
  user: SessionUser,
  params: VaccinationListParams,
) {
  const page = parsePage(params.page);
  const pageSize = parsePageSize(undefined);
  const db = getDb();
  const scope = empJoinScope(user);

  const where = and(
    isNull(employeeVaccinations.deletedAt),
    isNull(employees.deletedAt),
    scope,
    params.q
      ? or(
          ilike(employees.fullName, `%${params.q}%`),
          ilike(employees.registration, `%${params.q}%`),
        )
      : undefined,
  );

  const rawRows = await db
    .select({
      id: employeeVaccinations.id,
      employeeId: employeeVaccinations.employeeId,
      registration: employees.registration,
      fullName: employees.fullName,
      unitName: units.name,
      regionName: regions.name,
      vaccineCode: vaccines.code,
      doseNumber: employeeVaccinations.doseNumber,
      notes: employeeVaccinations.notes,
      status: employeeVaccinations.status,
    })
    .from(employeeVaccinations)
    .innerJoin(employees, eq(employeeVaccinations.employeeId, employees.id))
    .leftJoin(vaccines, eq(employeeVaccinations.vaccineId, vaccines.id))
    .leftJoin(units, eq(employees.unitId, units.id))
    .leftJoin(regions, eq(employees.regionId, regions.id))
    .where(where)
    .orderBy(desc(employeeVaccinations.updatedAt));

  const byEmployee = new Map<
    string,
    {
      employeeId: string;
      registration: string;
      fullName: string;
      unitName: string | null;
      regionName: string | null;
      situations: Record<string, string>;
      sourceId: string;
    }
  >();

  for (const r of rawRows) {
    const key = r.employeeId;
    const parsed = parseVaccinationNotes(r.notes);
    const existing = byEmployee.get(key);
    if (!existing) {
      const situations = { ...parsed };
      if (
        r.vaccineCode &&
        !situations[r.vaccineCode] &&
        r.status &&
        r.status !== "IMPORTADO"
      ) {
        situations[r.vaccineCode] = r.status;
      } else if (
        r.vaccineCode &&
        !situations[r.vaccineCode] &&
        r.status === "IMPORTADO" &&
        Object.keys(parsed).length === 0
      ) {
        situations[r.vaccineCode] = `Dose ${r.doseNumber}`;
      }
      byEmployee.set(key, {
        employeeId: r.employeeId,
        registration: r.registration,
        fullName: r.fullName,
        unitName: r.unitName,
        regionName: r.regionName,
        situations,
        sourceId: r.id,
      });
    } else {
      Object.assign(existing.situations, parsed);
      if (
        r.vaccineCode &&
        !existing.situations[r.vaccineCode] &&
        r.status &&
        r.status !== "IMPORTADO"
      ) {
        existing.situations[r.vaccineCode] = r.status;
      }
    }
  }

  let rows: VaccinationListRow[] = [...byEmployee.values()].map((emp) => {
    const kit = summarizeVaccinationKit(emp.situations);
    return {
      id: emp.sourceId,
      employeeId: emp.employeeId,
      registration: emp.registration,
      fullName: emp.fullName,
      unitName: emp.unitName,
      regionName: emp.regionName,
      situations: emp.situations,
      kit,
    };
  });

  const kitFilter = (params.kit ?? "ALL").trim();
  if (kitFilter === "complete") {
    rows = rows.filter((r) => r.kit.kitComplete);
  } else if (kitFilter === "incomplete") {
    rows = rows.filter((r) => !r.kit.kitComplete);
  } else if (kitFilter === "attention") {
    rows = rows.filter(
      (r) => r.kit.attentionCount > 0 || r.kit.partialCount > 0,
    );
  } else if (kitFilter === "refusal") {
    rows = rows.filter((r) => r.kit.refusalCount > 0);
  }

  rows.sort((a, b) => {
    if (a.kit.kitComplete !== b.kit.kitComplete) {
      return a.kit.kitComplete ? 1 : -1;
    }
    return a.fullName.localeCompare(b.fullName, "pt-BR");
  });

  // Métricas no universo total (antes do filtro de carteira)
  const allKits = [...byEmployee.values()].map((e) =>
    summarizeVaccinationKit(e.situations),
  );
  const metrics: VaccinationMetrics = {
    total: byEmployee.size,
    kitComplete: allKits.filter((k) => k.kitComplete).length,
    incomplete: allKits.filter((k) => !k.kitComplete).length,
    withRefusal: allKits.filter((k) => k.refusalCount > 0).length,
    attention: allKits.filter(
      (k) => k.attentionCount > 0 || k.partialCount > 0,
    ).length,
  };

  const total = rows.length;
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return {
    rows: pageRows,
    metrics,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type PregnancyListParams = {
  q?: string;
  status?: string;
  /** 1 = só insalubre; 0 = sem insalubridade */
  hazardous?: string;
  /** 1 = insalubre sem realocação (alerta operacional) */
  alert?: string;
  page?: string;
};

export type PregnancyListRow = {
  id: string;
  employeeId: string;
  registration: string;
  fullName: string;
  unitName: string | null;
  regionName: string | null;
  status: string;
  hazardousActivity: boolean | null;
  relocationNeeded: boolean | null;
  relocationDate: string | null;
  communicationDate: string | null;
  proofType: string | null;
  dueDate: string | null;
  originSector: string | null;
  destinationSector: string | null;
  leaveStartDate: string | null;
  maternityLeave: boolean | null;
  returnDate: string | null;
  notes: string | null;
};

export type PregnancyMetrics = {
  total: number;
  emAcompanhamento: number;
  licenca: number;
  encerrados: number;
  insalubre: number;
  semRealocacao: number;
};

export async function listPregnancies(
  user: SessionUser,
  params: PregnancyListParams,
) {
  const page = parsePage(params.page);
  const pageSize = parsePageSize(undefined);
  const db = getDb();
  const scope = empJoinScope(user);

  const baseWhere = and(
    isNull(pregnancyCases.deletedAt),
    isNull(employees.deletedAt),
    scope,
    params.q
      ? or(
          ilike(employees.fullName, `%${params.q}%`),
          ilike(employees.registration, `%${params.q}%`),
          ilike(pregnancyCases.originSector, `%${params.q}%`),
          ilike(pregnancyCases.destinationSector, `%${params.q}%`),
        )
      : undefined,
  );

  const listWhere = and(
    baseWhere,
    params.status && params.status !== "ALL"
      ? eq(pregnancyCases.status, params.status)
      : undefined,
    params.hazardous === "1"
      ? eq(pregnancyCases.hazardousActivity, true)
      : params.hazardous === "0"
        ? eq(pregnancyCases.hazardousActivity, false)
        : undefined,
    params.alert === "1"
      ? and(
          eq(pregnancyCases.hazardousActivity, true),
          isNull(pregnancyCases.relocationDate),
          eq(pregnancyCases.status, "EM_ACOMPANHAMENTO"),
        )
      : undefined,
  );

  const [totalRow] = await db
    .select({ value: count() })
    .from(pregnancyCases)
    .innerJoin(employees, eq(pregnancyCases.employeeId, employees.id))
    .where(listWhere);

  const [metricsRow] = await db
    .select({
      total: count(),
      emAcompanhamento: sql<number>`count(*) filter (where ${pregnancyCases.status} = 'EM_ACOMPANHAMENTO')::int`,
      licenca: sql<number>`count(*) filter (where ${pregnancyCases.status} = 'LICENCA')::int`,
      encerrados: sql<number>`count(*) filter (where ${pregnancyCases.status} = 'APTO')::int`,
      insalubre: sql<number>`count(*) filter (where ${pregnancyCases.hazardousActivity} = true)::int`,
      semRealocacao: sql<number>`count(*) filter (where ${pregnancyCases.hazardousActivity} = true and ${pregnancyCases.relocationDate} is null and ${pregnancyCases.status} = 'EM_ACOMPANHAMENTO')::int`,
    })
    .from(pregnancyCases)
    .innerJoin(employees, eq(pregnancyCases.employeeId, employees.id))
    .where(baseWhere);

  const rawRows = await db
    .select({
      id: pregnancyCases.id,
      employeeId: pregnancyCases.employeeId,
      registration: employees.registration,
      fullName: employees.fullName,
      unitName: units.name,
      regionName: regions.name,
      status: pregnancyCases.status,
      hazardousActivity: pregnancyCases.hazardousActivity,
      relocationNeeded: pregnancyCases.relocationNeeded,
      relocationDate: pregnancyCases.relocationDate,
      communicationDate: pregnancyCases.communicationDate,
      proofType: pregnancyCases.proofType,
      dueDate: pregnancyCases.dueDate,
      originSector: pregnancyCases.originSector,
      destinationSector: pregnancyCases.destinationSector,
      leaveStartDate: pregnancyCases.leaveStartDate,
      maternityLeave: pregnancyCases.maternityLeave,
      returnDate: pregnancyCases.returnDate,
      notes: pregnancyCases.notes,
    })
    .from(pregnancyCases)
    .innerJoin(employees, eq(pregnancyCases.employeeId, employees.id))
    .leftJoin(units, eq(employees.unitId, units.id))
    .leftJoin(regions, eq(employees.regionId, regions.id))
    .where(listWhere)
    .orderBy(desc(pregnancyCases.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const rows: PregnancyListRow[] = rawRows.map((r) => ({
    ...r,
    relocationDate: r.relocationDate
      ? String(r.relocationDate).slice(0, 10)
      : null,
    communicationDate: r.communicationDate
      ? String(r.communicationDate).slice(0, 10)
      : null,
    dueDate: r.dueDate ? String(r.dueDate).slice(0, 10) : null,
    leaveStartDate: r.leaveStartDate
      ? String(r.leaveStartDate).slice(0, 10)
      : null,
    returnDate: r.returnDate ? String(r.returnDate).slice(0, 10) : null,
  }));

  const total = totalRow?.value ?? 0;
  const metrics: PregnancyMetrics = {
    total: metricsRow?.total ?? 0,
    emAcompanhamento: metricsRow?.emAcompanhamento ?? 0,
    licenca: metricsRow?.licenca ?? 0,
    encerrados: metricsRow?.encerrados ?? 0,
    insalubre: metricsRow?.insalubre ?? 0,
    semRealocacao: metricsRow?.semRealocacao ?? 0,
  };

  return {
    rows,
    metrics,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type BiologicalListParams = {
  q?: string;
  status?: string;
  /** 1 = só com PEP; 0 = sem PEP */
  pep?: string;
  /** pending | overdue | done */
  followup?: string;
  page?: string;
};

export type BiologicalListRow = {
  id: string;
  employeeId: string;
  registration: string;
  fullName: string;
  unitName: string | null;
  regionName: string | null;
  occurredAt: Date | string;
  exposureType: string | null;
  bodyPart: string | null;
  description: string | null;
  pepStarted: boolean | null;
  pepStartDate: string | null;
  catNumber: string | null;
  status: string;
  conclusion: string | null;
  followups: BioFollowupView[];
  followupSummary: ReturnType<typeof summarizeFollowups>;
};

export type BiologicalMetrics = {
  total: number;
  emAcompanhamento: number;
  concluidos: number;
  comPep: number;
  followupsPendentes: number;
  followupsAtrasados: number;
};

export async function listBiologicalAccidents(
  user: SessionUser,
  params: BiologicalListParams,
) {
  const page = parsePage(params.page);
  const pageSize = parsePageSize(undefined);
  const db = getDb();
  const scope = empJoinScope(user);
  const today = new Date().toISOString().slice(0, 10);

  const where = and(
    isNull(biologicalAccidents.deletedAt),
    isNull(employees.deletedAt),
    scope,
    params.status && params.status !== "ALL"
      ? eq(biologicalAccidents.status, params.status)
      : undefined,
    params.pep === "1"
      ? eq(biologicalAccidents.pepStarted, true)
      : params.pep === "0"
        ? eq(biologicalAccidents.pepStarted, false)
        : undefined,
    params.q
      ? or(
          ilike(employees.fullName, `%${params.q}%`),
          ilike(employees.registration, `%${params.q}%`),
          ilike(biologicalAccidents.exposureType, `%${params.q}%`),
          ilike(biologicalAccidents.catNumber, `%${params.q}%`),
        )
      : undefined,
  );

  const rawRows = await db
    .select({
      id: biologicalAccidents.id,
      employeeId: biologicalAccidents.employeeId,
      registration: employees.registration,
      fullName: employees.fullName,
      unitName: units.name,
      regionName: regions.name,
      occurredAt: biologicalAccidents.occurredAt,
      exposureType: biologicalAccidents.exposureType,
      bodyPart: biologicalAccidents.bodyPart,
      description: biologicalAccidents.description,
      pepStarted: biologicalAccidents.pepStarted,
      pepStartDate: biologicalAccidents.pepStartDate,
      catNumber: biologicalAccidents.catNumber,
      status: biologicalAccidents.status,
      conclusion: biologicalAccidents.conclusion,
    })
    .from(biologicalAccidents)
    .innerJoin(employees, eq(biologicalAccidents.employeeId, employees.id))
    .leftJoin(units, eq(employees.unitId, units.id))
    .leftJoin(regions, eq(employees.regionId, regions.id))
    .where(where)
    .orderBy(desc(biologicalAccidents.occurredAt));

  const accidentIds = rawRows.map((r) => r.id);
  const followupRows =
    accidentIds.length > 0
      ? await db
          .select({
            id: biologicalAccidentFollowups.id,
            accidentId: biologicalAccidentFollowups.accidentId,
            dayOffset: biologicalAccidentFollowups.dayOffset,
            dueDate: biologicalAccidentFollowups.dueDate,
            performedAt: biologicalAccidentFollowups.performedAt,
            status: biologicalAccidentFollowups.status,
            notes: biologicalAccidentFollowups.notes,
          })
          .from(biologicalAccidentFollowups)
          .where(inArray(biologicalAccidentFollowups.accidentId, accidentIds))
          .orderBy(biologicalAccidentFollowups.dayOffset)
      : [];

  const followupsByAccident = new Map<string, BioFollowupView[]>();
  for (const f of followupRows) {
    const due = String(f.dueDate).slice(0, 10);
    const resolved = resolveFollowupDisplay(f.status, due, today);
    const view: BioFollowupView = {
      id: f.id,
      dayOffset: f.dayOffset,
      dueDate: due,
      performedAt: f.performedAt ? String(f.performedAt).slice(0, 10) : null,
      status: f.status,
      notes: f.notes,
      overdue: resolved.overdue,
      displayStatus: resolved.displayStatus,
    };
    const list = followupsByAccident.get(f.accidentId) ?? [];
    list.push(view);
    followupsByAccident.set(f.accidentId, list);
  }

  let rows: BiologicalListRow[] = rawRows.map((r) => {
    const followups = followupsByAccident.get(r.id) ?? [];
    return {
      id: r.id,
      employeeId: r.employeeId,
      registration: r.registration,
      fullName: r.fullName,
      unitName: r.unitName,
      regionName: r.regionName,
      occurredAt: r.occurredAt,
      exposureType: r.exposureType,
      bodyPart: r.bodyPart,
      description: r.description,
      pepStarted: r.pepStarted,
      pepStartDate: r.pepStartDate
        ? String(r.pepStartDate).slice(0, 10)
        : null,
      catNumber: r.catNumber,
      status: r.status,
      conclusion: r.conclusion,
      followups,
      followupSummary: summarizeFollowups(followups),
    };
  });

  const followupFilter = (params.followup ?? "ALL").trim();
  if (followupFilter === "overdue") {
    rows = rows.filter((r) => r.followupSummary.overdueCount > 0);
  } else if (followupFilter === "pending") {
    rows = rows.filter((r) => r.followupSummary.pendingCount > 0);
  } else if (followupFilter === "done") {
    rows = rows.filter(
      (r) =>
        r.followups.length > 0 && r.followupSummary.pendingCount === 0,
    );
  }

  // Métricas no universo filtrado por q/status/pep (antes do filtro de followup)
  const metricsBase = rawRows.map((r) => {
    const followups = followupsByAccident.get(r.id) ?? [];
    return summarizeFollowups(followups);
  });
  const metrics: BiologicalMetrics = {
    total: rawRows.length,
    emAcompanhamento: rawRows.filter((r) => r.status === "EM_ACOMPANHAMENTO")
      .length,
    concluidos: rawRows.filter((r) => r.status === "CONCLUIDO").length,
    comPep: rawRows.filter((r) => r.pepStarted).length,
    followupsPendentes: metricsBase.reduce((a, s) => a + s.pendingCount, 0),
    followupsAtrasados: metricsBase.reduce((a, s) => a + s.overdueCount, 0),
  };

  const total = rows.length;
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return {
    rows: pageRows,
    metrics,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** @deprecated Prefer `requireEmployeeInUserScope` — esta função não aplica escopo. */
export async function findEmployeeIdByRegistration(registration: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.registration, registration.trim()),
        isNull(employees.deletedAt),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

