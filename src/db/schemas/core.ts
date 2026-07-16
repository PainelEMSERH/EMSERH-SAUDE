import {
  boolean,
  date,
  index,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { auditActors, idColumn, softDelete, timestamps } from "./common";

export const coreSchema = pgSchema("core");

export const regions = coreSchema.table(
  "regions",
  {
    id: idColumn,
    code: text("code").notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
  (t) => [uniqueIndex("regions_code_uidx").on(t.code)],
);

export const units = coreSchema.table(
  "units",
  {
    id: idColumn,
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id),
    code: text("code"),
    name: text("name").notNull(),
    city: text("city"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
  (t) => [
    index("units_region_idx").on(t.regionId),
    uniqueIndex("units_name_region_uidx").on(t.regionId, t.name),
  ],
);

export const sectors = coreSchema.table(
  "sectors",
  {
    id: idColumn,
    unitId: uuid("unit_id").references(() => units.id),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [index("sectors_unit_idx").on(t.unitId)],
);

export const jobRoles = coreSchema.table(
  "job_roles",
  {
    id: idColumn,
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [uniqueIndex("job_roles_norm_uidx").on(t.normalizedName)],
);

export const employmentTypes = coreSchema.table("employment_types", {
  id: idColumn,
  name: text("name").notNull(),
  ...timestamps,
});

export const physicians = coreSchema.table(
  "physicians",
  {
    id: idColumn,
    name: text("name").notNull(),
    crm: text("crm"),
    code: text("code"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
  (t) => [index("physicians_name_idx").on(t.name)],
);

export const healthProfessionals = coreSchema.table(
  "health_professionals",
  {
    id: idColumn,
    name: text("name").notNull(),
    professionalType: text("professional_type").notNull(),
    registry: text("registry"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
    ...softDelete,
  },
);

export const employees = coreSchema.table(
  "employees",
  {
    id: idColumn,
    registration: text("registration").notNull(),
    fullName: text("full_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    cpfEncrypted: text("cpf_encrypted"),
    cpfHash: text("cpf_hash"),
    cnsEncrypted: text("cns_encrypted"),
    birthDate: date("birth_date"),
    sex: text("sex"),
    phone: text("phone"),
    mobile: text("mobile"),
    email: text("email"),
    admissionDate: date("admission_date"),
    dismissalDate: date("dismissal_date"),
    functionalStatus: text("functional_status").notNull().default("ATIVO"),
    jobRoleId: uuid("job_role_id").references(() => jobRoles.id),
    sectorId: uuid("sector_id").references(() => sectors.id),
    unitId: uuid("unit_id").references(() => units.id),
    regionId: uuid("region_id").references(() => regions.id),
    employmentTypeId: uuid("employment_type_id").references(
      () => employmentTypes.id,
    ),
    alterdataId: text("alterdata_id"),
    sourceSystem: text("source_system").default("ALTERDATA"),
    maritalStatus: text("marital_status"),
    city: text("city"),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
  (t) => [
    uniqueIndex("employees_registration_uidx").on(t.registration),
    uniqueIndex("employees_cpf_hash_uidx").on(t.cpfHash),
    index("employees_unit_idx").on(t.unitId),
    index("employees_region_idx").on(t.regionId),
    index("employees_status_idx").on(t.functionalStatus),
    index("employees_name_idx").on(t.normalizedName),
  ],
);

export const employeeAssignments = coreSchema.table(
  "employee_assignments",
  {
    id: idColumn,
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    regionId: uuid("region_id").references(() => regions.id),
    unitId: uuid("unit_id").references(() => units.id),
    sectorId: uuid("sector_id").references(() => sectors.id),
    jobRoleId: uuid("job_role_id").references(() => jobRoles.id),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    isCurrent: boolean("is_current").notNull().default(true),
    ...timestamps,
    ...auditActors,
  },
  (t) => [
    index("emp_assign_employee_idx").on(t.employeeId),
    index("emp_assign_current_idx").on(t.employeeId, t.isCurrent),
  ],
);

export const employeeStatusHistory = coreSchema.table(
  "employee_status_history",
  {
    id: idColumn,
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    status: text("status").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    notes: text("notes"),
    ...timestamps,
    ...auditActors,
  },
  (t) => [index("emp_status_hist_idx").on(t.employeeId)],
);

export const employeeContacts = coreSchema.table("employee_contacts", {
  id: idColumn,
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id),
  contactType: text("contact_type").notNull(),
  value: text("value").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  ...timestamps,
});
