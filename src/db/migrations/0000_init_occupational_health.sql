CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "core";
--> statement-breakpoint
CREATE SCHEMA "occupational";
--> statement-breakpoint
CREATE SCHEMA "files";
--> statement-breakpoint
CREATE SCHEMA "reporting";
--> statement-breakpoint
CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE TABLE "auth"."login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"success" boolean NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" text NOT NULL,
	"module" text NOT NULL,
	"action" text NOT NULL,
	"allowed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."user_region_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"region_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."user_unit_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"scope_level" text DEFAULT 'UNIT' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_reset_password" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "core"."employee_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"region_id" uuid,
	"unit_id" uuid,
	"sector_id" uuid,
	"job_role_id" uuid,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_current" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "core"."employee_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"contact_type" text NOT NULL,
	"value" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."employee_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"status" text NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "core"."employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration" text NOT NULL,
	"full_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"cpf_encrypted" text,
	"cpf_hash" text,
	"cns_encrypted" text,
	"birth_date" date,
	"sex" text,
	"phone" text,
	"mobile" text,
	"email" text,
	"admission_date" date,
	"dismissal_date" date,
	"functional_status" text DEFAULT 'ATIVO' NOT NULL,
	"job_role_id" uuid,
	"sector_id" uuid,
	"unit_id" uuid,
	"region_id" uuid,
	"employment_type_id" uuid,
	"alterdata_id" text,
	"source_system" text DEFAULT 'ALTERDATA',
	"marital_status" text,
	"city" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "core"."employment_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."health_professionals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"professional_type" text NOT NULL,
	"registry" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."job_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."physicians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"crm" text,
	"code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "core"."sectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"region_id" uuid NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"city" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."ambulatory_attendances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid,
	"unit_id" uuid,
	"attended_at" timestamp with time zone NOT NULL,
	"attendance_type" text NOT NULL,
	"conduct" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."appointment_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"status" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"physician_id" uuid,
	"unit_id" uuid,
	"scheduled_at" timestamp with time zone NOT NULL,
	"appointment_type" text NOT NULL,
	"confirmation_status" text DEFAULT 'PENDENTE',
	"presence_status" text,
	"conduct" text,
	"result" text,
	"weight_kg" double precision,
	"height_cm" double precision,
	"imc" double precision,
	"physical_activity" text,
	"lifestyle_habits" text,
	"health_profile" text,
	"clinical_notes" text,
	"admin_notes" text,
	"cancelled_at" timestamp with time zone,
	"rescheduled_from_id" uuid,
	"source_sheet" text,
	"source_row" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."aso_exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aso_record_id" uuid NOT NULL,
	"exam_name" text NOT NULL,
	"result" text,
	"performed_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occupational"."aso_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"aso_type" text NOT NULL,
	"scheduled_date" date,
	"expected_date" date,
	"performed_date" date,
	"attendance_status" text,
	"result" text,
	"restrictions" text,
	"physician_id" uuid,
	"crm" text,
	"periodicity_months" integer,
	"last_aso_date" date,
	"next_aso_date" date,
	"deadline_status" text,
	"summoned" boolean DEFAULT false NOT NULL,
	"alterdata_posted" boolean DEFAULT false NOT NULL,
	"admin_notes" text,
	"clinical_notes" text,
	"unit_id" uuid,
	"source_sheet" text,
	"source_row" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."aso_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"aso_record_id" uuid,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'AGENDADO' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."aso_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aso_record_id" uuid NOT NULL,
	"status" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."biological_accident_followups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accident_id" uuid NOT NULL,
	"day_offset" integer NOT NULL,
	"due_date" date NOT NULL,
	"performed_at" date,
	"status" text DEFAULT 'PENDENTE' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."biological_accidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"unit_id" uuid,
	"occurred_at" timestamp with time zone NOT NULL,
	"description" text,
	"exposure_type" text,
	"material" text,
	"body_part" text,
	"known_source" boolean,
	"pep_started" boolean DEFAULT false,
	"pep_start_date" date,
	"cat_number" text,
	"certificate_issued" boolean DEFAULT false,
	"leave_days" integer,
	"status" text DEFAULT 'EM_ACOMPANHAMENTO' NOT NULL,
	"conclusion" text,
	"source_sheet" text,
	"source_row" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."caring_space_satisfaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid,
	"period_month" date NOT NULL,
	"responses" integer,
	"satisfaction_score" double precision,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."cat_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accident_id" uuid,
	"employee_id" uuid NOT NULL,
	"cat_number" text,
	"issued_at" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."cid_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"normalized_code" text NOT NULL,
	"description" text,
	"chapter" text,
	"group_name" text,
	"category" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occupational"."committee_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid,
	"held_at" date NOT NULL,
	"committee_type" text NOT NULL,
	"participants" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."employee_vaccinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"vaccine_id" uuid NOT NULL,
	"dose_number" integer NOT NULL,
	"administered_at" date,
	"lot_number" text,
	"expires_at" date,
	"location" text,
	"next_dose_at" date,
	"notes" text,
	"status" text DEFAULT 'REGISTRADO' NOT NULL,
	"source_sheet" text,
	"source_row" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."external_attendances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid,
	"attended_at" timestamp with time zone NOT NULL,
	"location" text,
	"attendance_type" text,
	"result" text,
	"notes" text,
	"source_sheet" text,
	"source_row" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."immunity_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"test_type" text DEFAULT 'ANTI_HBS' NOT NULL,
	"tested_at" date NOT NULL,
	"result" text,
	"interpretation" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."leave_extensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leave_record_id" uuid NOT NULL,
	"previous_end_date" date NOT NULL,
	"new_end_date" date NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."leave_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type" text NOT NULL,
	"reason" text,
	"reason_simplified" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"days_count" integer,
	"cid_code" text,
	"cid_normalized" text,
	"cid_summary" text,
	"chapter" text,
	"group_name" text,
	"category" text,
	"status" text DEFAULT 'ATIVO' NOT NULL,
	"expected_return_date" date,
	"actual_return_date" date,
	"requires_return_aso" boolean DEFAULT false NOT NULL,
	"cat_linked" boolean DEFAULT false NOT NULL,
	"notes" text,
	"source_sheet" text,
	"source_row" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."medical_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_record_id" uuid,
	"issue_date" date NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days_count" integer,
	"cid_code" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."occupational_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid,
	"notified_at" date NOT NULL,
	"notification_type" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."pep_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accident_id" uuid NOT NULL,
	"started_at" date NOT NULL,
	"ended_at" date,
	"regimen" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."pregnancy_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"communication_date" date,
	"communication_month" text,
	"proof_type" text,
	"due_date" date,
	"hazardous_activity" boolean,
	"origin_sector" text,
	"relocation_needed" boolean,
	"destination_sector" text,
	"relocation_date" date,
	"leave_start_date" date,
	"maternity_leave" boolean DEFAULT false,
	"status" text DEFAULT 'EM_ACOMPANHAMENTO' NOT NULL,
	"return_date" date,
	"notes" text,
	"source_sheet" text,
	"source_row" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."pregnancy_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pregnancy_case_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"attachment_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occupational"."pregnancy_relocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pregnancy_case_id" uuid NOT NULL,
	"from_sector" text,
	"to_sector" text,
	"relocated_at" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."pregnancy_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pregnancy_case_id" uuid NOT NULL,
	"status" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."professional_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"physician_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"unit_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occupational"."return_to_work_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_record_id" uuid,
	"return_date" date NOT NULL,
	"aso_required" boolean DEFAULT true NOT NULL,
	"aso_record_id" uuid,
	"status" text DEFAULT 'PENDENTE' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."vaccine_refusals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"vaccine_id" uuid NOT NULL,
	"refused_at" date NOT NULL,
	"reason" text,
	"document_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "occupational"."vaccine_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vaccine_id" uuid NOT NULL,
	"dose_number" integer NOT NULL,
	"interval_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "occupational"."vaccines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"doses_required" integer DEFAULT 1,
	"validity_months" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files"."attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"original_name" text NOT NULL,
	"pathname" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"content_hash" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "files"."import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_name" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"total_rows" integer DEFAULT 0,
	"imported_rows" integer DEFAULT 0,
	"updated_rows" integer DEFAULT 0,
	"skipped_rows" integer DEFAULT 0,
	"duplicate_rows" integer DEFAULT 0,
	"error_rows" integer DEFAULT 0,
	"report_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "files"."import_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_number" integer,
	"field" text,
	"message" text NOT NULL,
	"raw_value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files"."import_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_hash" text NOT NULL,
	"sheet_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files"."import_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_name" text NOT NULL,
	"sheet_name" text NOT NULL,
	"source_column" text NOT NULL,
	"target_field" text NOT NULL,
	"transform" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files"."import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"sheet_name" text,
	"row_number" integer NOT NULL,
	"status" text NOT NULL,
	"source_payload" text,
	"entity_type" text,
	"entity_id" uuid,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reporting"."indicator_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"numerator_label" text,
	"denominator_label" text,
	"unit_label" text DEFAULT '%',
	"periodicity" text DEFAULT 'MENSAL' NOT NULL,
	"source" text,
	"calculation_rule" text,
	"rule_validation_status" text DEFAULT 'PENDENTE_VALIDACAO' NOT NULL,
	"owner" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "reporting"."indicator_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"indicator_id" uuid NOT NULL,
	"scope_level" text DEFAULT 'EMSERH' NOT NULL,
	"region_id" uuid,
	"unit_id" uuid,
	"period_month" date NOT NULL,
	"numerator" double precision,
	"denominator" double precision,
	"result_value" double precision,
	"target_value" double precision,
	"is_frozen" boolean DEFAULT false NOT NULL,
	"calculation_notes" text,
	"rule_validation_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "reporting"."indicator_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"indicator_id" uuid NOT NULL,
	"scope_level" text DEFAULT 'EMSERH' NOT NULL,
	"region_id" uuid,
	"unit_id" uuid,
	"period_month" date NOT NULL,
	"target_value" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "audit"."audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"ip_address" text,
	"user_agent" text,
	"before_data" jsonb,
	"after_data" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."user_region_scopes" ADD CONSTRAINT "user_region_scopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."user_unit_scopes" ADD CONSTRAINT "user_unit_scopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."employee_assignments" ADD CONSTRAINT "employee_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."employee_assignments" ADD CONSTRAINT "employee_assignments_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "core"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."employee_assignments" ADD CONSTRAINT "employee_assignments_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."employee_assignments" ADD CONSTRAINT "employee_assignments_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "core"."sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."employee_assignments" ADD CONSTRAINT "employee_assignments_job_role_id_job_roles_id_fk" FOREIGN KEY ("job_role_id") REFERENCES "core"."job_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."employee_contacts" ADD CONSTRAINT "employee_contacts_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."employee_status_history" ADD CONSTRAINT "employee_status_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."employees" ADD CONSTRAINT "employees_job_role_id_job_roles_id_fk" FOREIGN KEY ("job_role_id") REFERENCES "core"."job_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."employees" ADD CONSTRAINT "employees_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "core"."sectors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."employees" ADD CONSTRAINT "employees_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."employees" ADD CONSTRAINT "employees_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "core"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."employees" ADD CONSTRAINT "employees_employment_type_id_employment_types_id_fk" FOREIGN KEY ("employment_type_id") REFERENCES "core"."employment_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."sectors" ADD CONSTRAINT "sectors_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."units" ADD CONSTRAINT "units_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "core"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."ambulatory_attendances" ADD CONSTRAINT "ambulatory_attendances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."ambulatory_attendances" ADD CONSTRAINT "ambulatory_attendances_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."appointment_status_history" ADD CONSTRAINT "appointment_status_history_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "occupational"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."appointments" ADD CONSTRAINT "appointments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."appointments" ADD CONSTRAINT "appointments_physician_id_physicians_id_fk" FOREIGN KEY ("physician_id") REFERENCES "core"."physicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."appointments" ADD CONSTRAINT "appointments_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."aso_exams" ADD CONSTRAINT "aso_exams_aso_record_id_aso_records_id_fk" FOREIGN KEY ("aso_record_id") REFERENCES "occupational"."aso_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."aso_records" ADD CONSTRAINT "aso_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."aso_records" ADD CONSTRAINT "aso_records_physician_id_physicians_id_fk" FOREIGN KEY ("physician_id") REFERENCES "core"."physicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."aso_records" ADD CONSTRAINT "aso_records_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."aso_schedules" ADD CONSTRAINT "aso_schedules_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."aso_schedules" ADD CONSTRAINT "aso_schedules_aso_record_id_aso_records_id_fk" FOREIGN KEY ("aso_record_id") REFERENCES "occupational"."aso_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."aso_status_history" ADD CONSTRAINT "aso_status_history_aso_record_id_aso_records_id_fk" FOREIGN KEY ("aso_record_id") REFERENCES "occupational"."aso_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."biological_accident_followups" ADD CONSTRAINT "biological_accident_followups_accident_id_biological_accidents_id_fk" FOREIGN KEY ("accident_id") REFERENCES "occupational"."biological_accidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."biological_accidents" ADD CONSTRAINT "biological_accidents_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."biological_accidents" ADD CONSTRAINT "biological_accidents_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."caring_space_satisfaction" ADD CONSTRAINT "caring_space_satisfaction_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."cat_records" ADD CONSTRAINT "cat_records_accident_id_biological_accidents_id_fk" FOREIGN KEY ("accident_id") REFERENCES "occupational"."biological_accidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."cat_records" ADD CONSTRAINT "cat_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."committee_records" ADD CONSTRAINT "committee_records_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."employee_vaccinations" ADD CONSTRAINT "employee_vaccinations_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."employee_vaccinations" ADD CONSTRAINT "employee_vaccinations_vaccine_id_vaccines_id_fk" FOREIGN KEY ("vaccine_id") REFERENCES "occupational"."vaccines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."external_attendances" ADD CONSTRAINT "external_attendances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."immunity_tests" ADD CONSTRAINT "immunity_tests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."leave_extensions" ADD CONSTRAINT "leave_extensions_leave_record_id_leave_records_id_fk" FOREIGN KEY ("leave_record_id") REFERENCES "occupational"."leave_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."leave_records" ADD CONSTRAINT "leave_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."medical_certificates" ADD CONSTRAINT "medical_certificates_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."medical_certificates" ADD CONSTRAINT "medical_certificates_leave_record_id_leave_records_id_fk" FOREIGN KEY ("leave_record_id") REFERENCES "occupational"."leave_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."occupational_notifications" ADD CONSTRAINT "occupational_notifications_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."pep_records" ADD CONSTRAINT "pep_records_accident_id_biological_accidents_id_fk" FOREIGN KEY ("accident_id") REFERENCES "occupational"."biological_accidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."pregnancy_cases" ADD CONSTRAINT "pregnancy_cases_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."pregnancy_documents" ADD CONSTRAINT "pregnancy_documents_pregnancy_case_id_pregnancy_cases_id_fk" FOREIGN KEY ("pregnancy_case_id") REFERENCES "occupational"."pregnancy_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."pregnancy_relocations" ADD CONSTRAINT "pregnancy_relocations_pregnancy_case_id_pregnancy_cases_id_fk" FOREIGN KEY ("pregnancy_case_id") REFERENCES "occupational"."pregnancy_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."pregnancy_status_history" ADD CONSTRAINT "pregnancy_status_history_pregnancy_case_id_pregnancy_cases_id_fk" FOREIGN KEY ("pregnancy_case_id") REFERENCES "occupational"."pregnancy_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."professional_availability" ADD CONSTRAINT "professional_availability_physician_id_physicians_id_fk" FOREIGN KEY ("physician_id") REFERENCES "core"."physicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."professional_availability" ADD CONSTRAINT "professional_availability_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."return_to_work_records" ADD CONSTRAINT "return_to_work_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."return_to_work_records" ADD CONSTRAINT "return_to_work_records_leave_record_id_leave_records_id_fk" FOREIGN KEY ("leave_record_id") REFERENCES "occupational"."leave_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."return_to_work_records" ADD CONSTRAINT "return_to_work_records_aso_record_id_aso_records_id_fk" FOREIGN KEY ("aso_record_id") REFERENCES "occupational"."aso_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."vaccine_refusals" ADD CONSTRAINT "vaccine_refusals_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."vaccine_refusals" ADD CONSTRAINT "vaccine_refusals_vaccine_id_vaccines_id_fk" FOREIGN KEY ("vaccine_id") REFERENCES "occupational"."vaccines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occupational"."vaccine_schedules" ADD CONSTRAINT "vaccine_schedules_vaccine_id_vaccines_id_fk" FOREIGN KEY ("vaccine_id") REFERENCES "occupational"."vaccines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files"."import_errors" ADD CONSTRAINT "import_errors_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "files"."import_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files"."import_files" ADD CONSTRAINT "import_files_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "files"."import_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files"."import_rows" ADD CONSTRAINT "import_rows_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "files"."import_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting"."indicator_results" ADD CONSTRAINT "indicator_results_indicator_id_indicator_definitions_id_fk" FOREIGN KEY ("indicator_id") REFERENCES "reporting"."indicator_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting"."indicator_results" ADD CONSTRAINT "indicator_results_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "core"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting"."indicator_results" ADD CONSTRAINT "indicator_results_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting"."indicator_targets" ADD CONSTRAINT "indicator_targets_indicator_id_indicator_definitions_id_fk" FOREIGN KEY ("indicator_id") REFERENCES "reporting"."indicator_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting"."indicator_targets" ADD CONSTRAINT "indicator_targets_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "core"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reporting"."indicator_targets" ADD CONSTRAINT "indicator_targets_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "login_attempts_email_idx" ON "auth"."login_attempts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "login_attempts_created_idx" ON "auth"."login_attempts" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "role_perm_uidx" ON "auth"."role_permissions" USING btree ("role","module","action");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_uidx" ON "auth"."sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "auth"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "auth"."sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_region_uidx" ON "auth"."user_region_scopes" USING btree ("user_id","region_id");--> statement-breakpoint
CREATE INDEX "user_region_user_idx" ON "auth"."user_region_scopes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_unit_uidx" ON "auth"."user_unit_scopes" USING btree ("user_id","unit_id");--> statement-breakpoint
CREATE INDEX "user_unit_user_idx" ON "auth"."user_unit_scopes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uidx" ON "auth"."users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "auth"."users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "emp_assign_employee_idx" ON "core"."employee_assignments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "emp_assign_current_idx" ON "core"."employee_assignments" USING btree ("employee_id","is_current");--> statement-breakpoint
CREATE INDEX "emp_status_hist_idx" ON "core"."employee_status_history" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_registration_uidx" ON "core"."employees" USING btree ("registration");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_cpf_hash_uidx" ON "core"."employees" USING btree ("cpf_hash");--> statement-breakpoint
CREATE INDEX "employees_unit_idx" ON "core"."employees" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "employees_region_idx" ON "core"."employees" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX "employees_status_idx" ON "core"."employees" USING btree ("functional_status");--> statement-breakpoint
CREATE INDEX "employees_name_idx" ON "core"."employees" USING btree ("normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "job_roles_norm_uidx" ON "core"."job_roles" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "physicians_name_idx" ON "core"."physicians" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "regions_code_uidx" ON "core"."regions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "sectors_unit_idx" ON "core"."sectors" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "units_region_idx" ON "core"."units" USING btree ("region_id");--> statement-breakpoint
CREATE UNIQUE INDEX "units_name_region_uidx" ON "core"."units" USING btree ("region_id","name");--> statement-breakpoint
CREATE INDEX "appt_employee_idx" ON "occupational"."appointments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "appt_scheduled_idx" ON "occupational"."appointments" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "appt_physician_idx" ON "occupational"."appointments" USING btree ("physician_id");--> statement-breakpoint
CREATE UNIQUE INDEX "appt_physician_slot_uidx" ON "occupational"."appointments" USING btree ("physician_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "aso_employee_idx" ON "occupational"."aso_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "aso_next_date_idx" ON "occupational"."aso_records" USING btree ("next_aso_date");--> statement-breakpoint
CREATE INDEX "aso_deadline_idx" ON "occupational"."aso_records" USING btree ("deadline_status");--> statement-breakpoint
CREATE INDEX "aso_type_idx" ON "occupational"."aso_records" USING btree ("aso_type");--> statement-breakpoint
CREATE INDEX "aso_unit_idx" ON "occupational"."aso_records" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "aso_sched_employee_idx" ON "occupational"."aso_schedules" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "bio_followup_due_idx" ON "occupational"."biological_accident_followups" USING btree ("due_date","status");--> statement-breakpoint
CREATE UNIQUE INDEX "bio_followup_uidx" ON "occupational"."biological_accident_followups" USING btree ("accident_id","day_offset");--> statement-breakpoint
CREATE INDEX "bio_acc_employee_idx" ON "occupational"."biological_accidents" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "bio_acc_occurred_idx" ON "occupational"."biological_accidents" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cid_norm_uidx" ON "occupational"."cid_codes" USING btree ("normalized_code");--> statement-breakpoint
CREATE INDEX "emp_vac_employee_idx" ON "occupational"."employee_vaccinations" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "emp_vac_vaccine_idx" ON "occupational"."employee_vaccinations" USING btree ("vaccine_id");--> statement-breakpoint
CREATE UNIQUE INDEX "emp_vac_dose_uidx" ON "occupational"."employee_vaccinations" USING btree ("employee_id","vaccine_id","dose_number","administered_at");--> statement-breakpoint
CREATE INDEX "leave_employee_idx" ON "occupational"."leave_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "leave_status_idx" ON "occupational"."leave_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leave_dates_idx" ON "occupational"."leave_records" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "leave_cid_idx" ON "occupational"."leave_records" USING btree ("cid_normalized");--> statement-breakpoint
CREATE INDEX "pregnancy_employee_idx" ON "occupational"."pregnancy_cases" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "pregnancy_status_idx" ON "occupational"."pregnancy_cases" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "vaccines_code_uidx" ON "occupational"."vaccines" USING btree ("code");--> statement-breakpoint
CREATE INDEX "attachments_entity_idx" ON "files"."attachments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "attachments_pathname_idx" ON "files"."attachments" USING btree ("pathname");--> statement-breakpoint
CREATE INDEX "import_batches_status_idx" ON "files"."import_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "import_errors_batch_idx" ON "files"."import_errors" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "import_rows_batch_idx" ON "files"."import_rows" USING btree ("batch_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "indicator_code_uidx" ON "reporting"."indicator_definitions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "indicator_category_idx" ON "reporting"."indicator_definitions" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "indicator_results_uidx" ON "reporting"."indicator_results" USING btree ("indicator_id","scope_level","region_id","unit_id","period_month");--> statement-breakpoint
CREATE INDEX "indicator_results_period_idx" ON "reporting"."indicator_results" USING btree ("period_month");--> statement-breakpoint
CREATE INDEX "indicator_targets_idx" ON "reporting"."indicator_targets" USING btree ("indicator_id","period_month");--> statement-breakpoint
CREATE INDEX "audit_user_idx" ON "audit"."audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit"."audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit"."audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit"."audit_logs" USING btree ("created_at");