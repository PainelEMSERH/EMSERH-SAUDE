import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import {
  asoRecords,
  biologicalAccidentFollowups,
  biologicalAccidents,
  employeeVaccinations,
  employees,
  jobRoles,
  leaveRecords,
  pregnancyCases,
  regions,
  units,
  vaccines,
} from "@/db/schemas";
import type { ExcelColumn } from "@/lib/excel/export";
import { leaveTypeLabel } from "@/lib/leaves/constants";
import {
  formatUnitDisplayName,
  humanizeLabel,
} from "@/lib/labels";
import { hazardousLabel } from "@/lib/pregnancy/constants";
import type { ReportType } from "@/lib/reports/definitions";
import { employeeScopeCondition } from "@/lib/scope";
import type { SessionUser } from "@/types";

const LIMIT = 10000;

function dateStr(v: unknown): string {
  if (v == null) return "";
  return String(v).slice(0, 10);
}

function boolPt(v: boolean | null | undefined): string {
  if (v == null) return "";
  return v ? "Sim" : "Não";
}

export type ReportDataset = {
  columns: ExcelColumn[];
  rows: Record<string, unknown>[];
};

export async function buildReportDataset(
  user: SessionUser,
  type: ReportType,
): Promise<ReportDataset> {
  const db = getDb();
  const scope = employeeScopeCondition(user);

  if (type === "employees") {
    const rows = await db
      .select({
        matricula: employees.registration,
        nome: employees.fullName,
        situacao: employees.functionalStatus,
        sexo: employees.sex,
        nascimento: employees.birthDate,
        admissao: employees.admissionDate,
        demissao: employees.dismissalDate,
        cargo: jobRoles.name,
        unidade: units.name,
        regional: regions.name,
        cidade: employees.city,
        email: employees.email,
        telefone: employees.mobile,
      })
      .from(employees)
      .leftJoin(units, eq(employees.unitId, units.id))
      .leftJoin(regions, eq(employees.regionId, regions.id))
      .leftJoin(jobRoles, eq(employees.jobRoleId, jobRoles.id))
      .where(and(isNull(employees.deletedAt), scope))
      .orderBy(employees.fullName)
      .limit(LIMIT);

    return {
      columns: [
        { key: "matricula", header: "Matrícula", width: 12 },
        { key: "nome", header: "Nome", width: 36 },
        { key: "situacao", header: "Situação", width: 14 },
        { key: "sexo", header: "Sexo", width: 10 },
        { key: "nascimento", header: "Nascimento", width: 12 },
        { key: "admissao", header: "Admissão", width: 12 },
        { key: "demissao", header: "Demissão", width: 12 },
        { key: "cargo", header: "Cargo", width: 28 },
        { key: "unidade", header: "Unidade", width: 32 },
        { key: "regional", header: "Regional", width: 18 },
        { key: "cidade", header: "Cidade", width: 18 },
        { key: "email", header: "E-mail", width: 28 },
        { key: "telefone", header: "Telefone", width: 16 },
      ],
      rows: rows.map((r) => ({
        matricula: r.matricula,
        nome: r.nome,
        situacao: humanizeLabel(r.situacao),
        sexo: r.sexo ?? "",
        nascimento: dateStr(r.nascimento),
        admissao: dateStr(r.admissao),
        demissao: dateStr(r.demissao),
        cargo: r.cargo ?? "",
        unidade: formatUnitDisplayName(r.unidade, ""),
        regional: humanizeLabel(r.regional),
        cidade: r.cidade ?? "",
        email: r.email ?? "",
        telefone: r.telefone ?? "",
      })),
    };
  }

  if (type === "asos") {
    const rows = await db
      .select({
        matricula: employees.registration,
        nome: employees.fullName,
        situacao: employees.functionalStatus,
        unidade: units.name,
        regional: regions.name,
        tipo: asoRecords.asoType,
        previsto: asoRecords.expectedDate,
        agendado: asoRecords.scheduledDate,
        realizado: asoRecords.performedDate,
        ultimo: asoRecords.lastAsoDate,
        proximo: asoRecords.nextAsoDate,
        prazo: asoRecords.deadlineStatus,
        resultado: asoRecords.result,
        restricoes: asoRecords.restrictions,
        crm: asoRecords.crm,
        periodicidade: asoRecords.periodicityMonths,
        origem: asoRecords.origin,
        observacao: asoRecords.adminNotes,
      })
      .from(asoRecords)
      .innerJoin(employees, eq(asoRecords.employeeId, employees.id))
      .leftJoin(units, eq(employees.unitId, units.id))
      .leftJoin(regions, eq(employees.regionId, regions.id))
      .where(
        and(
          isNull(asoRecords.deletedAt),
          isNull(employees.deletedAt),
          scope,
        ),
      )
      .orderBy(desc(asoRecords.nextAsoDate))
      .limit(LIMIT);

    return {
      columns: [
        { key: "matricula", header: "Matrícula", width: 12 },
        { key: "nome", header: "Nome", width: 32 },
        { key: "situacao", header: "Sit. funcional", width: 14 },
        { key: "unidade", header: "Unidade", width: 28 },
        { key: "regional", header: "Regional", width: 16 },
        { key: "tipo", header: "Tipo ASO", width: 14 },
        { key: "previsto", header: "Previsto", width: 12 },
        { key: "agendado", header: "Agendado", width: 12 },
        { key: "realizado", header: "Realizado", width: 12 },
        { key: "ultimo", header: "Último ASO", width: 12 },
        { key: "proximo", header: "Próximo ASO", width: 12 },
        { key: "prazo", header: "Prazo", width: 14 },
        { key: "resultado", header: "Resultado", width: 18 },
        { key: "restricoes", header: "Restrições", width: 24 },
        { key: "crm", header: "CRM", width: 12 },
        { key: "periodicidade", header: "Periodicidade (meses)", width: 14 },
        { key: "origem", header: "Origem", width: 12 },
        { key: "observacao", header: "Observação", width: 28 },
      ],
      rows: rows.map((r) => ({
        matricula: r.matricula,
        nome: r.nome,
        situacao: humanizeLabel(r.situacao),
        unidade: formatUnitDisplayName(r.unidade, ""),
        regional: humanizeLabel(r.regional),
        tipo: humanizeLabel(r.tipo),
        previsto: dateStr(r.previsto),
        agendado: dateStr(r.agendado),
        realizado: dateStr(r.realizado),
        ultimo: dateStr(r.ultimo),
        proximo: dateStr(r.proximo),
        prazo: humanizeLabel(r.prazo),
        resultado: humanizeLabel(r.resultado),
        restricoes: r.restricoes ?? "",
        crm: r.crm ?? "",
        periodicidade: r.periodicidade ?? "",
        origem: humanizeLabel(r.origem),
        observacao: r.observacao ?? "",
      })),
    };
  }

  if (type === "leaves") {
    const rows = await db
      .select({
        matricula: employees.registration,
        nome: employees.fullName,
        unidade: units.name,
        regional: regions.name,
        tipo: leaveRecords.leaveType,
        inicio: leaveRecords.startDate,
        fim: leaveRecords.endDate,
        dias: leaveRecords.daysCount,
        status: leaveRecords.status,
        retornoEsperado: leaveRecords.expectedReturnDate,
        retornoEfetivo: leaveRecords.actualReturnDate,
        exigeRetornoAso: leaveRecords.requiresReturnAso,
        motivoResumo: leaveRecords.reasonSimplified,
        observacao: leaveRecords.notes,
      })
      .from(leaveRecords)
      .innerJoin(employees, eq(leaveRecords.employeeId, employees.id))
      .leftJoin(units, eq(employees.unitId, units.id))
      .leftJoin(regions, eq(employees.regionId, regions.id))
      .where(
        and(
          isNull(leaveRecords.deletedAt),
          isNull(employees.deletedAt),
          scope,
        ),
      )
      .orderBy(desc(leaveRecords.startDate))
      .limit(LIMIT);

    return {
      columns: [
        { key: "matricula", header: "Matrícula", width: 12 },
        { key: "nome", header: "Nome", width: 32 },
        { key: "unidade", header: "Unidade", width: 28 },
        { key: "regional", header: "Regional", width: 16 },
        { key: "tipo", header: "Tipo", width: 28 },
        { key: "inicio", header: "Início", width: 12 },
        { key: "fim", header: "Fim", width: 12 },
        { key: "dias", header: "Dias", width: 8 },
        { key: "status", header: "Status", width: 12 },
        { key: "retornoEsperado", header: "Retorno esperado", width: 14 },
        { key: "retornoEfetivo", header: "Retorno efetivo", width: 14 },
        { key: "exigeRetornoAso", header: "Exige retorno ASO", width: 14 },
        { key: "motivoResumo", header: "Motivo resumido", width: 22 },
        { key: "observacao", header: "Observação", width: 28 },
      ],
      rows: rows.map((r) => ({
        matricula: r.matricula,
        nome: r.nome,
        unidade: formatUnitDisplayName(r.unidade, ""),
        regional: humanizeLabel(r.regional),
        tipo: leaveTypeLabel(r.tipo),
        inicio: dateStr(r.inicio),
        fim: dateStr(r.fim),
        dias: r.dias ?? "",
        status: humanizeLabel(r.status),
        retornoEsperado: dateStr(r.retornoEsperado),
        retornoEfetivo: dateStr(r.retornoEfetivo),
        exigeRetornoAso: boolPt(r.exigeRetornoAso),
        motivoResumo: r.motivoResumo ?? "",
        observacao: r.observacao ?? "",
      })),
    };
  }

  if (type === "vaccinations") {
    const rows = await db
      .select({
        matricula: employees.registration,
        nome: employees.fullName,
        unidade: units.name,
        regional: regions.name,
        vacina: vaccines.name,
        codigo: vaccines.code,
        dose: employeeVaccinations.doseNumber,
        data: employeeVaccinations.administeredAt,
        status: employeeVaccinations.status,
        observacao: employeeVaccinations.notes,
      })
      .from(employeeVaccinations)
      .innerJoin(employees, eq(employeeVaccinations.employeeId, employees.id))
      .leftJoin(vaccines, eq(employeeVaccinations.vaccineId, vaccines.id))
      .leftJoin(units, eq(employees.unitId, units.id))
      .leftJoin(regions, eq(employees.regionId, regions.id))
      .where(
        and(
          isNull(employeeVaccinations.deletedAt),
          isNull(employees.deletedAt),
          scope,
        ),
      )
      .orderBy(desc(employeeVaccinations.administeredAt))
      .limit(LIMIT);

    return {
      columns: [
        { key: "matricula", header: "Matrícula", width: 12 },
        { key: "nome", header: "Nome", width: 32 },
        { key: "unidade", header: "Unidade", width: 28 },
        { key: "regional", header: "Regional", width: 16 },
        { key: "vacina", header: "Vacina", width: 22 },
        { key: "codigo", header: "Código", width: 12 },
        { key: "dose", header: "Dose", width: 8 },
        { key: "data", header: "Data", width: 12 },
        { key: "status", header: "Status / situação", width: 28 },
        { key: "observacao", header: "Observação", width: 28 },
      ],
      rows: rows.map((r) => ({
        matricula: r.matricula,
        nome: r.nome,
        unidade: formatUnitDisplayName(r.unidade, ""),
        regional: humanizeLabel(r.regional),
        vacina: r.vacina ?? "",
        codigo: r.codigo ?? "",
        dose: r.dose ?? "",
        data: dateStr(r.data),
        status: r.status ?? "",
        observacao: r.observacao ?? "",
      })),
    };
  }

  if (type === "pregnancies") {
    const rows = await db
      .select({
        matricula: employees.registration,
        nome: employees.fullName,
        unidade: units.name,
        regional: regions.name,
        status: pregnancyCases.status,
        comunicacao: pregnancyCases.communicationDate,
        comprovacao: pregnancyCases.proofType,
        previsaoParto: pregnancyCases.dueDate,
        insalubre: pregnancyCases.hazardousActivity,
        setorOrigem: pregnancyCases.originSector,
        setorDestino: pregnancyCases.destinationSector,
        dataRealocacao: pregnancyCases.relocationDate,
        inicioLicenca: pregnancyCases.leaveStartDate,
        retorno: pregnancyCases.returnDate,
        observacao: pregnancyCases.notes,
      })
      .from(pregnancyCases)
      .innerJoin(employees, eq(pregnancyCases.employeeId, employees.id))
      .leftJoin(units, eq(employees.unitId, units.id))
      .leftJoin(regions, eq(employees.regionId, regions.id))
      .where(
        and(
          isNull(pregnancyCases.deletedAt),
          isNull(employees.deletedAt),
          scope,
        ),
      )
      .orderBy(desc(pregnancyCases.createdAt))
      .limit(LIMIT);

    return {
      columns: [
        { key: "matricula", header: "Matrícula", width: 12 },
        { key: "nome", header: "Nome", width: 32 },
        { key: "unidade", header: "Unidade", width: 28 },
        { key: "regional", header: "Regional", width: 16 },
        { key: "status", header: "Status", width: 16 },
        { key: "comunicacao", header: "Comunicação", width: 12 },
        { key: "comprovacao", header: "Comprovação", width: 18 },
        { key: "previsaoParto", header: "Previsão parto", width: 12 },
        { key: "insalubre", header: "Insalubridade", width: 16 },
        { key: "setorOrigem", header: "Setor origem", width: 20 },
        { key: "setorDestino", header: "Setor destino", width: 20 },
        { key: "dataRealocacao", header: "Data realocação", width: 14 },
        { key: "inicioLicenca", header: "Início licença", width: 12 },
        { key: "retorno", header: "Retorno", width: 12 },
        { key: "observacao", header: "Observação", width: 28 },
      ],
      rows: rows.map((r) => {
        const haz = hazardousLabel({
          hazardousActivity: r.insalubre,
          relocationDate: r.dataRealocacao
            ? String(r.dataRealocacao).slice(0, 10)
            : null,
        });
        return {
          matricula: r.matricula,
          nome: r.nome,
          unidade: formatUnitDisplayName(r.unidade, ""),
          regional: humanizeLabel(r.regional),
          status: humanizeLabel(r.status),
          comunicacao: dateStr(r.comunicacao),
          comprovacao: r.comprovacao ?? "",
          previsaoParto: dateStr(r.previsaoParto),
          insalubre: haz.label,
          setorOrigem: r.setorOrigem ?? "",
          setorDestino: r.setorDestino ?? "",
          dataRealocacao: dateStr(r.dataRealocacao),
          inicioLicenca: dateStr(r.inicioLicenca),
          retorno: dateStr(r.retorno),
          observacao: r.observacao ?? "",
        };
      }),
    };
  }

  if (type === "biological") {
    const raw = await db
      .select({
        id: biologicalAccidents.id,
        matricula: employees.registration,
        nome: employees.fullName,
        unidade: units.name,
        regional: regions.name,
        ocorridoEm: biologicalAccidents.occurredAt,
        tipo: biologicalAccidents.exposureType,
        parteCorpo: biologicalAccidents.bodyPart,
        pep: biologicalAccidents.pepStarted,
        pepInicio: biologicalAccidents.pepStartDate,
        cat: biologicalAccidents.catNumber,
        status: biologicalAccidents.status,
        conclusao: biologicalAccidents.conclusion,
        descricao: biologicalAccidents.description,
      })
      .from(biologicalAccidents)
      .innerJoin(employees, eq(biologicalAccidents.employeeId, employees.id))
      .leftJoin(units, eq(employees.unitId, units.id))
      .leftJoin(regions, eq(employees.regionId, regions.id))
      .where(
        and(
          isNull(biologicalAccidents.deletedAt),
          isNull(employees.deletedAt),
          scope,
        ),
      )
      .orderBy(desc(biologicalAccidents.occurredAt))
      .limit(LIMIT);

    const ids = raw.map((r) => r.id);
    const fuByAccident = new Map<
      string,
      { d30: string; d60: string; d90: string }
    >();

    if (ids.length > 0) {
      const fuRows = await db
        .select({
          accidentId: biologicalAccidentFollowups.accidentId,
          dayOffset: biologicalAccidentFollowups.dayOffset,
          dueDate: biologicalAccidentFollowups.dueDate,
          performedAt: biologicalAccidentFollowups.performedAt,
        })
        .from(biologicalAccidentFollowups)
        .where(inArray(biologicalAccidentFollowups.accidentId, ids));

      for (const f of fuRows) {
        const cur = fuByAccident.get(f.accidentId) ?? {
          d30: "",
          d60: "",
          d90: "",
        };
        const label = f.performedAt
          ? `Ok ${dateStr(f.performedAt)}`
          : `Pend. ${dateStr(f.dueDate)}`;
        if (f.dayOffset === 30) cur.d30 = label;
        if (f.dayOffset === 60) cur.d60 = label;
        if (f.dayOffset === 90) cur.d90 = label;
        fuByAccident.set(f.accidentId, cur);
      }
    }

    return {
      columns: [
        { key: "matricula", header: "Matrícula", width: 12 },
        { key: "nome", header: "Nome", width: 32 },
        { key: "unidade", header: "Unidade", width: 28 },
        { key: "regional", header: "Regional", width: 16 },
        { key: "ocorridoEm", header: "Data ocorrência", width: 16 },
        { key: "tipo", header: "Local / tipo", width: 28 },
        { key: "parteCorpo", header: "Parte do corpo", width: 18 },
        { key: "pep", header: "PEP", width: 8 },
        { key: "pepInicio", header: "Início PEP", width: 12 },
        { key: "cat", header: "CAT", width: 16 },
        { key: "status", header: "Status", width: 16 },
        { key: "d30", header: "D30", width: 14 },
        { key: "d60", header: "D60", width: 14 },
        { key: "d90", header: "D90", width: 14 },
        { key: "conclusao", header: "Conclusão", width: 24 },
        { key: "descricao", header: "Descrição", width: 32 },
      ],
      rows: raw.map((r) => {
        const fu = fuByAccident.get(r.id) ?? { d30: "", d60: "", d90: "" };
        const when =
          r.ocorridoEm instanceof Date
            ? r.ocorridoEm.toISOString().slice(0, 16).replace("T", " ")
            : String(r.ocorridoEm ?? "").slice(0, 16).replace("T", " ");
        return {
          matricula: r.matricula,
          nome: r.nome,
          unidade: formatUnitDisplayName(r.unidade, ""),
          regional: humanizeLabel(r.regional),
          ocorridoEm: when,
          tipo: r.tipo ?? "",
          parteCorpo: r.parteCorpo ?? "",
          pep: boolPt(r.pep),
          pepInicio: dateStr(r.pepInicio),
          cat: r.cat ?? "",
          status: humanizeLabel(r.status),
          d30: fu.d30,
          d60: fu.d60,
          d90: fu.d90,
          conclusao: r.conclusao ?? "",
          descricao: r.descricao ?? "",
        };
      }),
    };
  }

  throw new Error(`Relatório inválido: ${type}`);
}
