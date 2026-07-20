CREATE TABLE IF NOT EXISTS "occupational"."clinic_aso_attendances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "attendance_date" date NOT NULL,
  "registration" varchar(32) NOT NULL,
  "employee_id" uuid,
  "employee_name" text NOT NULL,
  "department" text DEFAULT '' NOT NULL,
  "job_title" text DEFAULT '' NOT NULL,
  "cpf" varchar(11) DEFAULT '' NOT NULL,
  "sus" varchar(20) DEFAULT '' NOT NULL,
  "attendance_type" varchar(60) NOT NULL,
  "situation" varchar(20) NOT NULL,
  "conduct" text DEFAULT '' NOT NULL,
  "physician_code" varchar(32) NOT NULL,
  "physician_name" varchar(160) NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "physical_activity" varchar(10) NOT NULL,
  "lifestyle" varchar(40) NOT NULL,
  "sex" varchar(20) NOT NULL,
  "weight" numeric(8, 2),
  "height" numeric(8, 2),
  "bmi" numeric(8, 2),
  "bmi_result" varchar(60) DEFAULT '' NOT NULL,
  "profile" text DEFAULT '' NOT NULL,
  "city" varchar(120) DEFAULT '' NOT NULL,
  "birth_date" date,
  "age" integer,
  "aso_file_name" varchar(260),
  "aso_file_hash" varchar(128),
  "aso_blob_url" text,
  "drive_file_id" varchar(128),
  "drive_url" text,
  "email_status" varchar(20) DEFAULT 'PENDING' NOT NULL,
  "email_error" text,
  "email_sent_at" timestamp with time zone,
  "extraction_status" varchar(20) DEFAULT 'NONE' NOT NULL,
  "extraction_raw" jsonb,
  "unit_id" uuid,
  "region_id" uuid,
  "physician_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" uuid,
  "updated_by" uuid
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clinic_aso_hash_uidx" ON "occupational"."clinic_aso_attendances" USING btree ("aso_file_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clinic_aso_date_idx" ON "occupational"."clinic_aso_attendances" USING btree ("attendance_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clinic_aso_registration_idx" ON "occupational"."clinic_aso_attendances" USING btree ("registration");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clinic_aso_employee_idx" ON "occupational"."clinic_aso_attendances" USING btree ("employee_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "occupational"."clinic_aso_attendances" ADD CONSTRAINT "clinic_aso_attendances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "core"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "occupational"."clinic_aso_attendances" ADD CONSTRAINT "clinic_aso_attendances_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "occupational"."clinic_aso_attendances" ADD CONSTRAINT "clinic_aso_attendances_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "core"."regions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "occupational"."clinic_aso_attendances" ADD CONSTRAINT "clinic_aso_attendances_physician_id_physicians_id_fk" FOREIGN KEY ("physician_id") REFERENCES "core"."physicians"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
