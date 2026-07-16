import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { employees, physicians, units } from "./core";
import { auditActors, idColumn, softDelete, timestamps } from "./common";

export const occupationalSchema = pgSchema("occupational");

export const asoRecords = occupationalSchema.table(
  "aso_records",
  {
    id: idColumn,
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    asoType: text("aso_type").notNull(),
    scheduledDate: date("scheduled_date"),
    expectedDate: date("expected_date"),
    performedDate: date("performed_date"),
    attendanceStatus: text("attendance_status"),
    result: text("result"),
    restrictions: text("restrictions"),
    physicianId: uuid("physician_id").references(() => physicians.id),
    crm: text("crm"),
    periodicityMonths: integer("periodicity_months"),
    lastAsoDate: date("last_aso_date"),
    nextAsoDate: date("next_aso_date"),
    deadlineStatus: text("deadline_status"),
    summoned: boolean("summoned").notNull().default(false),
    alterdataPosted: boolean("alterdata_posted").notNull().default(false),
    adminNotes: text("admin_notes"),
    clinicalNotes: text("clinical_notes"),
    unitId: uuid("unit_id").references(() => units.id),
    sourceSheet: text("source_sheet"),
    sourceRow: integer("source_row"),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
  (t) => [
    index("aso_employee_idx").on(t.employeeId),
    index("aso_next_date_idx").on(t.nextAsoDate),
    index("aso_deadline_idx").on(t.deadlineStatus),
    index("aso_type_idx").on(t.asoType),
    index("aso_unit_idx").on(t.unitId),
  ],
);

export const asoSchedules = occupationalSchema.table(
  "aso_schedules",
  {
    id: idColumn,
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    asoRecordId: uuid("aso_record_id").references(() => asoRecords.id),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("AGENDADO"),
    notes: text("notes"),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
  (t) => [index("aso_sched_employee_idx").on(t.employeeId)],
);

export const asoExams = occupationalSchema.table("aso_exams", {
  id: idColumn,
  asoRecordId: uuid("aso_record_id")
    .notNull()
    .references(() => asoRecords.id),
  examName: text("exam_name").notNull(),
  result: text("result"),
  performedAt: date("performed_at"),
  ...timestamps,
});

export const asoStatusHistory = occupationalSchema.table(
  "aso_status_history",
  {
    id: idColumn,
    asoRecordId: uuid("aso_record_id")
      .notNull()
      .references(() => asoRecords.id),
    status: text("status").notNull(),
    notes: text("notes"),
    ...timestamps,
    ...auditActors,
  },
);

export const appointments = occupationalSchema.table(
  "appointments",
  {
    id: idColumn,
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    physicianId: uuid("physician_id").references(() => physicians.id),
    unitId: uuid("unit_id").references(() => units.id),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    appointmentType: text("appointment_type").notNull(),
    confirmationStatus: text("confirmation_status").default("PENDENTE"),
    presenceStatus: text("presence_status"),
    conduct: text("conduct"),
    result: text("result"),
    weightKg: doublePrecision("weight_kg"),
    heightCm: doublePrecision("height_cm"),
    imc: doublePrecision("imc"),
    physicalActivity: text("physical_activity"),
    lifestyleHabits: text("lifestyle_habits"),
    healthProfile: text("health_profile"),
    clinicalNotes: text("clinical_notes"),
    adminNotes: text("admin_notes"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    rescheduledFromId: uuid("rescheduled_from_id"),
    sourceSheet: text("source_sheet"),
    sourceRow: integer("source_row"),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
  (t) => [
    index("appt_employee_idx").on(t.employeeId),
    index("appt_scheduled_idx").on(t.scheduledAt),
    index("appt_physician_idx").on(t.physicianId),
    uniqueIndex("appt_physician_slot_uidx").on(t.physicianId, t.scheduledAt),
  ],
);

export const appointmentStatusHistory = occupationalSchema.table(
  "appointment_status_history",
  {
    id: idColumn,
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id),
    status: text("status").notNull(),
    notes: text("notes"),
    ...timestamps,
    ...auditActors,
  },
);

export const professionalAvailability = occupationalSchema.table(
  "professional_availability",
  {
    id: idColumn,
    physicianId: uuid("physician_id")
      .notNull()
      .references(() => physicians.id),
    weekday: integer("weekday").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    unitId: uuid("unit_id").references(() => units.id),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
);

export const cidCodes = occupationalSchema.table(
  "cid_codes",
  {
    id: idColumn,
    code: text("code").notNull(),
    normalizedCode: text("normalized_code").notNull(),
    description: text("description"),
    chapter: text("chapter"),
    groupName: text("group_name"),
    category: text("category"),
    ...timestamps,
  },
  (t) => [uniqueIndex("cid_norm_uidx").on(t.normalizedCode)],
);

export const leaveRecords = occupationalSchema.table(
  "leave_records",
  {
    id: idColumn,
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    leaveType: text("leave_type").notNull(),
    reason: text("reason"),
    reasonSimplified: text("reason_simplified"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    daysCount: integer("days_count"),
    cidCode: text("cid_code"),
    cidNormalized: text("cid_normalized"),
    cidSummary: text("cid_summary"),
    chapter: text("chapter"),
    groupName: text("group_name"),
    category: text("category"),
    status: text("status").notNull().default("ATIVO"),
    expectedReturnDate: date("expected_return_date"),
    actualReturnDate: date("actual_return_date"),
    requiresReturnAso: boolean("requires_return_aso").notNull().default(false),
    catLinked: boolean("cat_linked").notNull().default(false),
    notes: text("notes"),
    sourceSheet: text("source_sheet"),
    sourceRow: integer("source_row"),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
  (t) => [
    index("leave_employee_idx").on(t.employeeId),
    index("leave_status_idx").on(t.status),
    index("leave_dates_idx").on(t.startDate, t.endDate),
    index("leave_cid_idx").on(t.cidNormalized),
  ],
);

export const medicalCertificates = occupationalSchema.table(
  "medical_certificates",
  {
    id: idColumn,
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    leaveRecordId: uuid("leave_record_id").references(() => leaveRecords.id),
    issueDate: date("issue_date").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    daysCount: integer("days_count"),
    cidCode: text("cid_code"),
    notes: text("notes"),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
);

export const leaveExtensions = occupationalSchema.table(
  "leave_extensions",
  {
    id: idColumn,
    leaveRecordId: uuid("leave_record_id")
      .notNull()
      .references(() => leaveRecords.id),
    previousEndDate: date("previous_end_date").notNull(),
    newEndDate: date("new_end_date").notNull(),
    reason: text("reason"),
    ...timestamps,
    ...auditActors,
  },
);

export const returnToWorkRecords = occupationalSchema.table(
  "return_to_work_records",
  {
    id: idColumn,
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    leaveRecordId: uuid("leave_record_id").references(() => leaveRecords.id),
    returnDate: date("return_date").notNull(),
    asoRequired: boolean("aso_required").notNull().default(true),
    asoRecordId: uuid("aso_record_id").references(() => asoRecords.id),
    status: text("status").notNull().default("PENDENTE"),
    notes: text("notes"),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
);

export const vaccines = occupationalSchema.table(
  "vaccines",
  {
    id: idColumn,
    code: text("code").notNull(),
    name: text("name").notNull(),
    dosesRequired: integer("doses_required").default(1),
    validityMonths: integer("validity_months"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("vaccines_code_uidx").on(t.code)],
);

export const vaccineSchedules = occupationalSchema.table(
  "vaccine_schedules",
  {
    id: idColumn,
    vaccineId: uuid("vaccine_id")
      .notNull()
      .references(() => vaccines.id),
    doseNumber: integer("dose_number").notNull(),
    intervalDays: integer("interval_days"),
    ...timestamps,
  },
);

export const employeeVaccinations = occupationalSchema.table(
  "employee_vaccinations",
  {
    id: idColumn,
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    vaccineId: uuid("vaccine_id")
      .notNull()
      .references(() => vaccines.id),
    doseNumber: integer("dose_number").notNull(),
    administeredAt: date("administered_at"),
    lotNumber: text("lot_number"),
    expiresAt: date("expires_at"),
    location: text("location"),
    nextDoseAt: date("next_dose_at"),
    notes: text("notes"),
    status: text("status").notNull().default("REGISTRADO"),
    sourceSheet: text("source_sheet"),
    sourceRow: integer("source_row"),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
  (t) => [
    index("emp_vac_employee_idx").on(t.employeeId),
    index("emp_vac_vaccine_idx").on(t.vaccineId),
    uniqueIndex("emp_vac_dose_uidx").on(
      t.employeeId,
      t.vaccineId,
      t.doseNumber,
      t.administeredAt,
    ),
  ],
);

export const vaccineRefusals = occupationalSchema.table(
  "vaccine_refusals",
  {
    id: idColumn,
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    vaccineId: uuid("vaccine_id")
      .notNull()
      .references(() => vaccines.id),
    refusedAt: date("refused_at").notNull(),
    reason: text("reason"),
    documentPath: text("document_path"),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
);

export const immunityTests = occupationalSchema.table(
  "immunity_tests",
  {
    id: idColumn,
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    testType: text("test_type").notNull().default("ANTI_HBS"),
    testedAt: date("tested_at").notNull(),
    result: text("result"),
    interpretation: text("interpretation"),
    notes: text("notes"),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
);

export const pregnancyCases = occupationalSchema.table(
  "pregnancy_cases",
  {
    id: idColumn,
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    communicationDate: date("communication_date"),
    communicationMonth: text("communication_month"),
    proofType: text("proof_type"),
    dueDate: date("due_date"),
    hazardousActivity: boolean("hazardous_activity"),
    originSector: text("origin_sector"),
    relocationNeeded: boolean("relocation_needed"),
    destinationSector: text("destination_sector"),
    relocationDate: date("relocation_date"),
    leaveStartDate: date("leave_start_date"),
    maternityLeave: boolean("maternity_leave").default(false),
    status: text("status").notNull().default("EM_ACOMPANHAMENTO"),
    returnDate: date("return_date"),
    notes: text("notes"),
    sourceSheet: text("source_sheet"),
    sourceRow: integer("source_row"),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
  (t) => [
    index("pregnancy_employee_idx").on(t.employeeId),
    index("pregnancy_status_idx").on(t.status),
  ],
);

export const pregnancyDocuments = occupationalSchema.table(
  "pregnancy_documents",
  {
    id: idColumn,
    pregnancyCaseId: uuid("pregnancy_case_id")
      .notNull()
      .references(() => pregnancyCases.id),
    documentType: text("document_type").notNull(),
    attachmentId: uuid("attachment_id"),
    notes: text("notes"),
    ...timestamps,
  },
);

export const pregnancyRelocations = occupationalSchema.table(
  "pregnancy_relocations",
  {
    id: idColumn,
    pregnancyCaseId: uuid("pregnancy_case_id")
      .notNull()
      .references(() => pregnancyCases.id),
    fromSector: text("from_sector"),
    toSector: text("to_sector"),
    relocatedAt: date("relocated_at").notNull(),
    notes: text("notes"),
    ...timestamps,
    ...auditActors,
  },
);

export const pregnancyStatusHistory = occupationalSchema.table(
  "pregnancy_status_history",
  {
    id: idColumn,
    pregnancyCaseId: uuid("pregnancy_case_id")
      .notNull()
      .references(() => pregnancyCases.id),
    status: text("status").notNull(),
    notes: text("notes"),
    ...timestamps,
    ...auditActors,
  },
);

export const biologicalAccidents = occupationalSchema.table(
  "biological_accidents",
  {
    id: idColumn,
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    unitId: uuid("unit_id").references(() => units.id),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    description: text("description"),
    exposureType: text("exposure_type"),
    material: text("material"),
    bodyPart: text("body_part"),
    knownSource: boolean("known_source"),
    pepStarted: boolean("pep_started").default(false),
    pepStartDate: date("pep_start_date"),
    catNumber: text("cat_number"),
    certificateIssued: boolean("certificate_issued").default(false),
    leaveDays: integer("leave_days"),
    status: text("status").notNull().default("EM_ACOMPANHAMENTO"),
    conclusion: text("conclusion"),
    sourceSheet: text("source_sheet"),
    sourceRow: integer("source_row"),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
  (t) => [
    index("bio_acc_employee_idx").on(t.employeeId),
    index("bio_acc_occurred_idx").on(t.occurredAt),
  ],
);

export const biologicalAccidentFollowups = occupationalSchema.table(
  "biological_accident_followups",
  {
    id: idColumn,
    accidentId: uuid("accident_id")
      .notNull()
      .references(() => biologicalAccidents.id),
    dayOffset: integer("day_offset").notNull(),
    dueDate: date("due_date").notNull(),
    performedAt: date("performed_at"),
    status: text("status").notNull().default("PENDENTE"),
    notes: text("notes"),
    ...timestamps,
    ...auditActors,
  },
  (t) => [
    index("bio_followup_due_idx").on(t.dueDate, t.status),
    uniqueIndex("bio_followup_uidx").on(t.accidentId, t.dayOffset),
  ],
);

export const pepRecords = occupationalSchema.table("pep_records", {
  id: idColumn,
  accidentId: uuid("accident_id")
    .notNull()
    .references(() => biologicalAccidents.id),
  startedAt: date("started_at").notNull(),
  endedAt: date("ended_at"),
  regimen: text("regimen"),
  notes: text("notes"),
  ...timestamps,
  ...auditActors,
});

export const catRecords = occupationalSchema.table("cat_records", {
  id: idColumn,
  accidentId: uuid("accident_id").references(() => biologicalAccidents.id),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id),
  catNumber: text("cat_number"),
  issuedAt: date("issued_at"),
  notes: text("notes"),
  ...timestamps,
  ...softDelete,
  ...auditActors,
});

export const ambulatoryAttendances = occupationalSchema.table(
  "ambulatory_attendances",
  {
    id: idColumn,
    employeeId: uuid("employee_id").references(() => employees.id),
    unitId: uuid("unit_id").references(() => units.id),
    attendedAt: timestamp("attended_at", { withTimezone: true }).notNull(),
    attendanceType: text("attendance_type").notNull(),
    conduct: text("conduct"),
    notes: text("notes"),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
);

export const externalAttendances = occupationalSchema.table(
  "external_attendances",
  {
    id: idColumn,
    employeeId: uuid("employee_id").references(() => employees.id),
    attendedAt: timestamp("attended_at", { withTimezone: true }).notNull(),
    location: text("location"),
    attendanceType: text("attendance_type"),
    result: text("result"),
    notes: text("notes"),
    sourceSheet: text("source_sheet"),
    sourceRow: integer("source_row"),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
);

export const occupationalNotifications = occupationalSchema.table(
  "occupational_notifications",
  {
    id: idColumn,
    unitId: uuid("unit_id").references(() => units.id),
    notifiedAt: date("notified_at").notNull(),
    notificationType: text("notification_type").notNull(),
    quantity: integer("quantity").notNull().default(1),
    notes: text("notes"),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
);

export const committeeRecords = occupationalSchema.table(
  "committee_records",
  {
    id: idColumn,
    unitId: uuid("unit_id").references(() => units.id),
    heldAt: date("held_at").notNull(),
    committeeType: text("committee_type").notNull(),
    participants: integer("participants"),
    notes: text("notes"),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
);

export const caringSpaceSatisfaction = occupationalSchema.table(
  "caring_space_satisfaction",
  {
    id: idColumn,
    unitId: uuid("unit_id").references(() => units.id),
    periodMonth: date("period_month").notNull(),
    responses: integer("responses"),
    satisfactionScore: doublePrecision("satisfaction_score"),
    notes: text("notes"),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
);
