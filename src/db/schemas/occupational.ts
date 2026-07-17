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
import { employees, physicians, regions, units } from "./core";
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
    regionId: uuid("region_id").references(() => regions.id),
    /** Vínculo com item do planejamento mensal. */
    planId: uuid("plan_id"),
    /** MANUAL | IMPORT | SYNC */
    origin: text("origin").default("MANUAL"),
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
    index("aso_region_idx").on(t.regionId),
    index("aso_plan_idx").on(t.planId),
    index("aso_performed_idx").on(t.performedDate),
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

/**
 * Planejamento mensal nominal de ASOs.
 * Preserva lotação/situação no momento do planejamento.
 */
export const asoMonthlyPlans = occupationalSchema.table(
  "aso_monthly_plans",
  {
    id: idColumn,
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    registration: text("registration").notNull(),
    employeeName: text("employee_name").notNull(),
    asoType: text("aso_type").notNull(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    expectedDate: date("expected_date"),
    regionId: uuid("region_id").references(() => regions.id),
    unitId: uuid("unit_id").references(() => units.id),
    regionNameSnapshot: text("region_name_snapshot"),
    unitNameSnapshot: text("unit_name_snapshot"),
    functionalStatusSnapshot: text("functional_status_snapshot"),
    /** ALTERDATA_NEXT_ASO | ADMISSION | DISMISSAL | RETURN | MANUAL_RISK_CHANGE | IMPORT | MIGRATION */
    predictionOrigin: text("prediction_origin").notNull(),
    /** ELEGIVEL | JUSTIFICADO | NAO_ELEGIVEL */
    eligibility: text("eligibility").notNull().default("ELEGIVEL"),
    justificationReason: text("justification_reason"),
    justificationNotes: text("justification_notes"),
    justifiedAt: timestamp("justified_at", { withTimezone: true }),
    justifiedBy: uuid("justified_by"),
    /** PREVISTO | AGENDADO | REALIZADO | NAO_REALIZADO | VENCIDO | REPROGRAMADO | JUSTIFICADO | DISPENSADO */
    executionStatus: text("execution_status").notNull().default("PREVISTO"),
    /**
     * NAO_APLICAVEL | AGUARDANDO_SINCRONIZACAO | CONFIRMADO | PENDENTE_ATUALIZACAO |
     * DIVERGENCIA_DATA | ATUALIZADO_SEM_REGISTRO | SEM_HISTORICO
     */
    alterdataStatus: text("alterdata_status").notNull().default("NAO_APLICAVEL"),
    asoRecordId: uuid("aso_record_id").references(() => asoRecords.id),
    reprogrammedToDate: date("reprogrammed_to_date"),
    reprogrammedReason: text("reprogrammed_reason"),
    /** Congelado quando competência está FECHADA. */
    frozen: boolean("frozen").notNull().default(false),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
  (t) => [
    uniqueIndex("aso_plans_employee_type_ym_uidx").on(
      t.employeeId,
      t.asoType,
      t.year,
      t.month,
    ),
    index("aso_plans_year_month_idx").on(t.year, t.month),
    index("aso_plans_type_idx").on(t.asoType),
    index("aso_plans_region_idx").on(t.regionId),
    index("aso_plans_unit_idx").on(t.unitId),
    index("aso_plans_execution_idx").on(t.executionStatus),
    index("aso_plans_alterdata_idx").on(t.alterdataStatus),
    index("aso_plans_eligibility_idx").on(t.eligibility),
  ],
);

/** Histórico append-only das datas de ASO observadas no espelho Alterdata. */
export const asoAlterdataSnapshots = occupationalSchema.table(
  "aso_alterdata_snapshots",
  {
    id: idColumn,
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    registration: text("registration").notNull(),
    nextAsoDate: date("next_aso_date"),
    lastAsoDate: date("last_aso_date"),
    statusAso: text("status_aso"),
    periodicityMonths: integer("periodicity_months"),
    regionId: uuid("region_id").references(() => regions.id),
    unitId: uuid("unit_id").references(() => units.id),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull(),
    batchId: uuid("batch_id"),
    sourceHash: text("source_hash"),
    sourceRef: text("source_ref"),
    ...timestamps,
  },
  (t) => [
    index("aso_snap_employee_idx").on(t.employeeId),
    index("aso_snap_synced_idx").on(t.syncedAt),
    index("aso_snap_reg_idx").on(t.registration),
    index("aso_snap_batch_idx").on(t.batchId),
    index("aso_snap_next_idx").on(t.nextAsoDate),
  ],
);

/** Metas percentuais por ano/competência/tipo/escopo. */
export const asoTargets = occupationalSchema.table(
  "aso_targets",
  {
    id: idColumn,
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    asoType: text("aso_type").notNull().default("ALL"),
    /** EMSERH | REGION | UNIT */
    scopeType: text("scope_type").notNull(),
    regionId: uuid("region_id").references(() => regions.id),
    unitId: uuid("unit_id").references(() => units.id),
    targetPercent: doublePrecision("target_percent").notNull(),
    notes: text("notes"),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
  (t) => [
    uniqueIndex("aso_targets_scope_uidx").on(
      t.year,
      t.month,
      t.asoType,
      t.scopeType,
      t.regionId,
      t.unitId,
    ),
    index("aso_targets_year_idx").on(t.year),
  ],
);

export const asoTargetHistory = occupationalSchema.table(
  "aso_target_history",
  {
    id: idColumn,
    targetId: uuid("target_id")
      .notNull()
      .references(() => asoTargets.id),
    previousPercent: doublePrecision("previous_percent"),
    newPercent: doublePrecision("new_percent").notNull(),
    reason: text("reason"),
    ...timestamps,
    ...auditActors,
  },
  (t) => [index("aso_target_hist_idx").on(t.targetId)],
);

/** Fechamento de competência (ano/mês/tipo/escopo). */
export const asoCompetenceClosures = occupationalSchema.table(
  "aso_competence_closures",
  {
    id: idColumn,
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    asoType: text("aso_type").notNull().default("ALL"),
    scopeType: text("scope_type").notNull().default("EMSERH"),
    regionId: uuid("region_id").references(() => regions.id),
    unitId: uuid("unit_id").references(() => units.id),
    /** ABERTA | EM_CONFERENCIA | FECHADA */
    status: text("status").notNull().default("ABERTA"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: uuid("closed_by"),
    reopenReason: text("reopen_reason"),
    reopenedAt: timestamp("reopened_at", { withTimezone: true }),
    reopenedBy: uuid("reopened_by"),
    notes: text("notes"),
    ...timestamps,
    ...auditActors,
  },
  (t) => [
    uniqueIndex("aso_closure_scope_uidx").on(
      t.year,
      t.month,
      t.asoType,
      t.scopeType,
      t.regionId,
      t.unitId,
    ),
    index("aso_closure_status_idx").on(t.status),
  ],
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
