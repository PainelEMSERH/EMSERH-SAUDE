-- ASO management module (additive)
--> statement-breakpoint
ALTER TABLE "occupational"."aso_records" ADD COLUMN IF NOT EXISTS "region_id" uuid;--> statement-breakpoint
ALTER TABLE "occupational"."aso_records" ADD COLUMN IF NOT EXISTS "plan_id" uuid;--> statement-breakpoint
ALTER TABLE "occupational"."aso_records" ADD COLUMN IF NOT EXISTS "origin" text DEFAULT 'MANUAL';--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "occupational"."aso_records"
    ADD CONSTRAINT "aso_records_region_id_regions_id_fk"
    FOREIGN KEY ("region_id") REFERENCES "core"."regions"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aso_region_idx" ON "occupational"."aso_records" ("region_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aso_plan_idx" ON "occupational"."aso_records" ("plan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aso_performed_idx" ON "occupational"."aso_records" ("performed_date");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "occupational"."aso_monthly_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "registration" text NOT NULL,
  "employee_name" text NOT NULL,
  "aso_type" text NOT NULL,
  "year" integer NOT NULL,
  "month" integer NOT NULL,
  "expected_date" date,
  "region_id" uuid,
  "unit_id" uuid,
  "region_name_snapshot" text,
  "unit_name_snapshot" text,
  "functional_status_snapshot" text,
  "prediction_origin" text NOT NULL,
  "eligibility" text DEFAULT 'ELEGIVEL' NOT NULL,
  "justification_reason" text,
  "justification_notes" text,
  "justified_at" timestamp with time zone,
  "justified_by" uuid,
  "execution_status" text DEFAULT 'PREVISTO' NOT NULL,
  "alterdata_status" text DEFAULT 'NAO_APLICAVEL' NOT NULL,
  "aso_record_id" uuid,
  "reprogrammed_to_date" date,
  "reprogrammed_reason" text,
  "frozen" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" uuid,
  "updated_by" uuid
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "occupational"."aso_monthly_plans"
    ADD CONSTRAINT "aso_monthly_plans_employee_id_employees_id_fk"
    FOREIGN KEY ("employee_id") REFERENCES "core"."employees"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "occupational"."aso_monthly_plans"
    ADD CONSTRAINT "aso_monthly_plans_region_id_regions_id_fk"
    FOREIGN KEY ("region_id") REFERENCES "core"."regions"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "occupational"."aso_monthly_plans"
    ADD CONSTRAINT "aso_monthly_plans_unit_id_units_id_fk"
    FOREIGN KEY ("unit_id") REFERENCES "core"."units"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "occupational"."aso_monthly_plans"
    ADD CONSTRAINT "aso_monthly_plans_aso_record_id_aso_records_id_fk"
    FOREIGN KEY ("aso_record_id") REFERENCES "occupational"."aso_records"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aso_plans_employee_type_ym_uidx"
  ON "occupational"."aso_monthly_plans" ("employee_id","aso_type","year","month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aso_plans_year_month_idx" ON "occupational"."aso_monthly_plans" ("year","month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aso_plans_type_idx" ON "occupational"."aso_monthly_plans" ("aso_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aso_plans_region_idx" ON "occupational"."aso_monthly_plans" ("region_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aso_plans_unit_idx" ON "occupational"."aso_monthly_plans" ("unit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aso_plans_execution_idx" ON "occupational"."aso_monthly_plans" ("execution_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aso_plans_alterdata_idx" ON "occupational"."aso_monthly_plans" ("alterdata_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aso_plans_eligibility_idx" ON "occupational"."aso_monthly_plans" ("eligibility");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "occupational"."aso_alterdata_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "registration" text NOT NULL,
  "next_aso_date" date,
  "last_aso_date" date,
  "status_aso" text,
  "periodicity_months" integer,
  "region_id" uuid,
  "unit_id" uuid,
  "synced_at" timestamp with time zone NOT NULL,
  "batch_id" uuid,
  "source_hash" text,
  "source_ref" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "occupational"."aso_alterdata_snapshots"
    ADD CONSTRAINT "aso_alterdata_snapshots_employee_id_employees_id_fk"
    FOREIGN KEY ("employee_id") REFERENCES "core"."employees"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aso_snap_employee_idx" ON "occupational"."aso_alterdata_snapshots" ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aso_snap_synced_idx" ON "occupational"."aso_alterdata_snapshots" ("synced_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aso_snap_reg_idx" ON "occupational"."aso_alterdata_snapshots" ("registration");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aso_snap_batch_idx" ON "occupational"."aso_alterdata_snapshots" ("batch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aso_snap_next_idx" ON "occupational"."aso_alterdata_snapshots" ("next_aso_date");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "occupational"."aso_targets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "year" integer NOT NULL,
  "month" integer NOT NULL,
  "aso_type" text DEFAULT 'ALL' NOT NULL,
  "scope_type" text NOT NULL,
  "region_id" uuid,
  "unit_id" uuid,
  "target_percent" double precision NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_by" uuid,
  "updated_by" uuid
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aso_targets_scope_uidx"
  ON "occupational"."aso_targets" (
    "year","month","aso_type","scope_type",
    COALESCE("region_id", '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE("unit_id", '00000000-0000-0000-0000-000000000000'::uuid)
  );--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aso_targets_year_idx" ON "occupational"."aso_targets" ("year");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "occupational"."aso_target_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "target_id" uuid NOT NULL,
  "previous_percent" double precision,
  "new_percent" double precision NOT NULL,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "occupational"."aso_target_history"
    ADD CONSTRAINT "aso_target_history_target_id_aso_targets_id_fk"
    FOREIGN KEY ("target_id") REFERENCES "occupational"."aso_targets"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aso_target_hist_idx" ON "occupational"."aso_target_history" ("target_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "occupational"."aso_competence_closures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "year" integer NOT NULL,
  "month" integer NOT NULL,
  "aso_type" text DEFAULT 'ALL' NOT NULL,
  "scope_type" text DEFAULT 'EMSERH' NOT NULL,
  "region_id" uuid,
  "unit_id" uuid,
  "status" text DEFAULT 'ABERTA' NOT NULL,
  "closed_at" timestamp with time zone,
  "closed_by" uuid,
  "reopen_reason" text,
  "reopened_at" timestamp with time zone,
  "reopened_by" uuid,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aso_closure_scope_uidx"
  ON "occupational"."aso_competence_closures" (
    "year","month","aso_type","scope_type",
    COALESCE("region_id", '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE("unit_id", '00000000-0000-0000-0000-000000000000'::uuid)
  );--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aso_closure_status_idx" ON "occupational"."aso_competence_closures" ("status");
