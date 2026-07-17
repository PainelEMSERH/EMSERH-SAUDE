import { and, desc, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import {
  asoRecords,
  employeeVaccinations,
  employees,
  leaveRecords,
  regions,
  units,
  vaccines,
} from "@/db/schemas";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { employeeScopeCondition } from "@/lib/scope";

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "sem_dados\n";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(";"),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const raw = row[h];
          const value = raw == null ? "" : String(raw);
          return `"${value.replaceAll('"', '""')}"`;
        })
        .join(";"),
    ),
  ];
  return lines.join("\n");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ type: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !can(user, "reports", "export")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { type } = await context.params;
  const db = getDb();
  const scope = employeeScopeCondition(user);
  let rows: Record<string, unknown>[] = [];

  if (type === "employees") {
    rows = await db
      .select({
        matricula: employees.registration,
        nome: employees.fullName,
        situacao: employees.functionalStatus,
        unidade: units.name,
        regional: regions.name,
        cidade: employees.city,
      })
      .from(employees)
      .leftJoin(units, eq(employees.unitId, units.id))
      .leftJoin(regions, eq(employees.regionId, regions.id))
      .where(and(isNull(employees.deletedAt), scope))
      .orderBy(employees.fullName)
      .limit(5000);
  } else if (type === "asos") {
    rows = await db
      .select({
        matricula: employees.registration,
        nome: employees.fullName,
        tipo: asoRecords.asoType,
        proximo: asoRecords.nextAsoDate,
        prazo: asoRecords.deadlineStatus,
        resultado: asoRecords.result,
      })
      .from(asoRecords)
      .innerJoin(employees, eq(asoRecords.employeeId, employees.id))
      .where(and(isNull(asoRecords.deletedAt), isNull(employees.deletedAt), scope))
      .orderBy(desc(asoRecords.nextAsoDate))
      .limit(5000);
  } else if (type === "leaves") {
    rows = await db
      .select({
        matricula: employees.registration,
        nome: employees.fullName,
        tipo: leaveRecords.leaveType,
        inicio: leaveRecords.startDate,
        fim: leaveRecords.endDate,
        dias: leaveRecords.daysCount,
        status: leaveRecords.status,
      })
      .from(leaveRecords)
      .innerJoin(employees, eq(leaveRecords.employeeId, employees.id))
      .where(
        and(isNull(leaveRecords.deletedAt), isNull(employees.deletedAt), scope),
      )
      .orderBy(desc(leaveRecords.startDate))
      .limit(5000);
  } else if (type === "vaccinations") {
    rows = await db
      .select({
        matricula: employees.registration,
        nome: employees.fullName,
        vacina: vaccines.name,
        dose: employeeVaccinations.doseNumber,
        data: employeeVaccinations.administeredAt,
        status: employeeVaccinations.status,
      })
      .from(employeeVaccinations)
      .innerJoin(employees, eq(employeeVaccinations.employeeId, employees.id))
      .leftJoin(vaccines, eq(employeeVaccinations.vaccineId, vaccines.id))
      .where(
        and(
          isNull(employeeVaccinations.deletedAt),
          isNull(employees.deletedAt),
          scope,
        ),
      )
      .orderBy(desc(employeeVaccinations.administeredAt))
      .limit(5000);
  } else {
    return NextResponse.json({ error: "Relatório inválido" }, { status: 404 });
  }

  await writeAuditLog({
    user,
    action: "EXPORT",
    entityType: "report",
    entityId: type,
    metadata: { rows: rows.length },
  });

  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="emserh-${type}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
