import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import {
  clinicAsoAttendances,
  employees,
  jobRoles,
  physicians,
  units,
} from "@/db/schemas";
import { can } from "@/lib/permissions";
import { resolveCpfDisplayResult } from "@/lib/employees/cpf-display";
import { hashCpf, normalizeCpf } from "@/lib/encryption";
import type { SessionUser } from "@/types";

export type ClinicEmployeeLookup = {
  id: string;
  registration: string;
  fullName: string;
  cpf: string;
  department: string;
  jobTitle: string;
  city: string;
  birthDate: string | null;
  sex: string | null;
  unitId: string | null;
  regionId: string | null;
};

export async function lookupEmployeeByRegistration(
  user: SessionUser,
  registration: string,
): Promise<ClinicEmployeeLookup | null> {
  const db = getDb();
  const rows = await db
    .select({
      id: employees.id,
      registration: employees.registration,
      fullName: employees.fullName,
      cpfEncrypted: employees.cpfEncrypted,
      cpfHash: employees.cpfHash,
      city: employees.city,
      birthDate: employees.birthDate,
      sex: employees.sex,
      unitId: employees.unitId,
      regionId: employees.regionId,
      unitName: units.name,
      jobRoleName: jobRoles.name,
    })
    .from(employees)
    .leftJoin(units, eq(employees.unitId, units.id))
    .leftJoin(jobRoles, eq(employees.jobRoleId, jobRoles.id))
    .where(
      and(
        eq(employees.registration, registration),
        isNull(employees.deletedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return mapEmployeeLookup(row, user);
}

function mapEmployeeLookup(
  row: {
    id: string;
    registration: string;
    fullName: string;
    cpfEncrypted: string | null;
    cpfHash: string | null;
    city: string | null;
    birthDate: string | null;
    sex: string | null;
    unitId: string | null;
    regionId: string | null;
    unitName: string | null;
    jobRoleName: string | null;
  },
  user: SessionUser,
): ClinicEmployeeLookup {
  const cpfResult = resolveCpfDisplayResult(
    row.cpfEncrypted,
    row.cpfHash,
    can(user, "employees", "view_sensitive_identifiers"),
  );
  const cpfDigits =
    cpfResult.status === "AVAILABLE"
      ? cpfResult.display.replace(/\D/g, "")
      : "";

  return {
    id: row.id,
    registration: row.registration,
    fullName: row.fullName,
    cpf: cpfDigits,
    department: row.unitName ?? "",
    jobTitle: row.jobRoleName ?? "",
    city: row.city ?? "",
    birthDate: row.birthDate,
    sex:
      row.sex === "M" || row.sex?.toLowerCase().startsWith("m")
        ? "Masculino"
        : row.sex === "F" || row.sex?.toLowerCase().startsWith("f")
          ? "Feminino"
          : row.sex,
    unitId: row.unitId,
    regionId: row.regionId,
  };
}

const employeeSelect = {
  id: employees.id,
  registration: employees.registration,
  fullName: employees.fullName,
  cpfEncrypted: employees.cpfEncrypted,
  cpfHash: employees.cpfHash,
  city: employees.city,
  birthDate: employees.birthDate,
  sex: employees.sex,
  unitId: employees.unitId,
  regionId: employees.regionId,
  unitName: units.name,
  jobRoleName: jobRoles.name,
};

export async function lookupEmployeeByCpf(
  user: SessionUser,
  cpf: string,
): Promise<ClinicEmployeeLookup | null> {
  const digits = normalizeCpf(cpf);
  if (digits.length !== 11) return null;
  const db = getDb();
  const rows = await db
    .select(employeeSelect)
    .from(employees)
    .leftJoin(units, eq(employees.unitId, units.id))
    .leftJoin(jobRoles, eq(employees.jobRoleId, jobRoles.id))
    .where(
      and(eq(employees.cpfHash, hashCpf(digits)), isNull(employees.deletedAt)),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return mapEmployeeLookup(row, user);
}

export async function listClinicPhysicians() {
  const db = getDb();
  return db
    .select({
      id: physicians.id,
      code: physicians.code,
      name: physicians.name,
      crm: physicians.crm,
    })
    .from(physicians)
    .where(and(eq(physicians.isActive, true), isNull(physicians.deletedAt)))
    .orderBy(asc(physicians.name));
}

export async function listClinicAttendances(limit = 100) {
  const db = getDb();
  return db
    .select()
    .from(clinicAsoAttendances)
    .where(isNull(clinicAsoAttendances.deletedAt))
    .orderBy(
      desc(clinicAsoAttendances.attendanceDate),
      desc(clinicAsoAttendances.createdAt),
    )
    .limit(limit);
}

export async function ensureDefaultClinicPhysicians() {
  const db = getDb();
  const defaults = [
    { code: "1160", name: "Reginaldo" },
    { code: "12", name: "Médico Clínico" },
    { code: "15", name: "Janderson" },
  ];
  for (const p of defaults) {
    const existing = await db
      .select({ id: physicians.id })
      .from(physicians)
      .where(and(eq(physicians.code, p.code), isNull(physicians.deletedAt)))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(physicians).values({
        code: p.code,
        name: p.name,
        isActive: true,
      });
    }
  }
}
