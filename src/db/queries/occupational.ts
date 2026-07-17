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
  classifySituation,
  parseVaccinationNotes,
  resolveVaccineCode,
  VACCINE_DEFS,
} from "@/lib/vaccination/constants";
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
  vaccine?: string;
  situation?: string;
  kind?: string;
  page?: string;
};

export type VaccinationListRow = {
  id: string;
  employeeId: string;
  registration: string;
  fullName: string;
  unitName: string | null;
  regionName: string | null;
  vaccineCode: string;
  vaccineName: string;
  situation: string;
  situationKind: "ok" | "partial" | "attention" | "refusal" | "unknown";
  administeredAt: string | null;
  lotNumber: string | null;
  notes: string | null;
  status: string;
};

export type VaccinationMetrics = {
  total: number;
  ok: number;
  partial: number;
  attention: number;
  refusal: number;
};

export type VaccinationTabCounts = Record<string, number>;

export async function listVaccinations(
  user: SessionUser,
  params: VaccinationListParams,
) {
  const page = parsePage(params.page);
  const pageSize = parsePageSize(undefined);
  const db = getDb();
  const scope = empJoinScope(user);
  const vaccineCode = resolveVaccineCode(params.vaccine);

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
      vaccineName: vaccines.name,
      doseNumber: employeeVaccinations.doseNumber,
      administeredAt: employeeVaccinations.administeredAt,
      lotNumber: employeeVaccinations.lotNumber,
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

  // Import legado: 1 linha TETANO com notes agregando todas as vacinas.
  // Expande para visão por vacina (aba).
  const byEmployee = new Map<
    string,
    {
      employeeId: string;
      registration: string;
      fullName: string;
      unitName: string | null;
      regionName: string | null;
      situations: Record<string, string>;
      administeredAt: string | null;
      lotNumber: string | null;
      sourceId: string;
      status: string;
    }
  >();

  for (const r of rawRows) {
    const key = r.employeeId;
    const parsed = parseVaccinationNotes(r.notes);
    const existing = byEmployee.get(key);
    if (!existing) {
      const situations = { ...parsed };
      // Registro “limpo” de uma única vacina
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
        administeredAt: r.administeredAt
          ? String(r.administeredAt).slice(0, 10)
          : null,
        lotNumber: r.lotNumber,
        sourceId: r.id,
        status: r.status,
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

  const tabCounts: VaccinationTabCounts = {};
  for (const v of VACCINE_DEFS) tabCounts[v.code] = 0;

  const exploded: VaccinationListRow[] = [];
  for (const emp of byEmployee.values()) {
    for (const v of VACCINE_DEFS) {
      const situation = emp.situations[v.code];
      if (!situation) continue;
      tabCounts[v.code] = (tabCounts[v.code] ?? 0) + 1;
      const kind = classifySituation(v.code, situation);
      exploded.push({
        id: `${emp.sourceId}:${v.code}`,
        employeeId: emp.employeeId,
        registration: emp.registration,
        fullName: emp.fullName,
        unitName: emp.unitName,
        regionName: emp.regionName,
        vaccineCode: v.code,
        vaccineName: v.label,
        situation,
        situationKind: kind,
        administeredAt: emp.administeredAt,
        lotNumber: emp.lotNumber,
        notes: null,
        status: emp.status,
      });
    }
  }

  let filtered = exploded.filter((r) => r.vaccineCode === vaccineCode);
  if (params.situation && params.situation !== "ALL") {
    filtered = filtered.filter((r) => r.situation === params.situation);
  }
  if (params.kind && params.kind !== "ALL") {
    filtered = filtered.filter((r) => r.situationKind === params.kind);
  }

  filtered.sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));

  const metrics: VaccinationMetrics = {
    total: filtered.length,
    ok: filtered.filter((r) => r.situationKind === "ok").length,
    partial: filtered.filter((r) => r.situationKind === "partial").length,
    attention: filtered.filter((r) => r.situationKind === "attention").length,
    refusal: filtered.filter((r) => r.situationKind === "refusal").length,
  };

  const total = filtered.length;
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  return {
    rows: pageRows,
    metrics,
    tabCounts,
    vaccine: vaccineCode,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listPregnancies(
  user: SessionUser,
  params: { q?: string; status?: string; page?: string },
) {
  const page = parsePage(params.page);
  const pageSize = parsePageSize(undefined);
  const db = getDb();
  const scope = empJoinScope(user);
  const where = and(
    isNull(pregnancyCases.deletedAt),
    isNull(employees.deletedAt),
    scope,
    params.status && params.status !== "ALL"
      ? eq(pregnancyCases.status, params.status)
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
    .from(pregnancyCases)
    .innerJoin(employees, eq(pregnancyCases.employeeId, employees.id))
    .where(where);

  const rows = await db
    .select({
      id: pregnancyCases.id,
      registration: employees.registration,
      fullName: employees.fullName,
      status: pregnancyCases.status,
      hazardousActivity: pregnancyCases.hazardousActivity,
      relocationDate: pregnancyCases.relocationDate,
      communicationDate: pregnancyCases.communicationDate,
      originSector: pregnancyCases.originSector,
      destinationSector: pregnancyCases.destinationSector,
    })
    .from(pregnancyCases)
    .innerJoin(employees, eq(pregnancyCases.employeeId, employees.id))
    .where(where)
    .orderBy(desc(pregnancyCases.createdAt))
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

export async function listBiologicalAccidents(
  user: SessionUser,
  params: { q?: string; status?: string; page?: string },
) {
  const page = parsePage(params.page);
  const pageSize = parsePageSize(undefined);
  const db = getDb();
  const scope = empJoinScope(user);
  const where = and(
    isNull(biologicalAccidents.deletedAt),
    isNull(employees.deletedAt),
    scope,
    params.status && params.status !== "ALL"
      ? eq(biologicalAccidents.status, params.status)
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
    .from(biologicalAccidents)
    .innerJoin(employees, eq(biologicalAccidents.employeeId, employees.id))
    .where(where);

  const rows = await db
    .select({
      id: biologicalAccidents.id,
      registration: employees.registration,
      fullName: employees.fullName,
      occurredAt: biologicalAccidents.occurredAt,
      exposureType: biologicalAccidents.exposureType,
      status: biologicalAccidents.status,
      pepStarted: biologicalAccidents.pepStarted,
      catNumber: biologicalAccidents.catNumber,
      pendingFollowups: sql<number>`(
        select count(*)::int from occupational.biological_accident_followups f
        where f.accident_id = ${biologicalAccidents.id} and f.status = 'PENDENTE'
      )`,
    })
    .from(biologicalAccidents)
    .innerJoin(employees, eq(biologicalAccidents.employeeId, employees.id))
    .where(where)
    .orderBy(desc(biologicalAccidents.occurredAt))
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
