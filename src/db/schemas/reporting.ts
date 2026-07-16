import {
  boolean,
  date,
  doublePrecision,
  index,
  pgSchema,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { regions, units } from "./core";
import { auditActors, idColumn, softDelete, timestamps } from "./common";

export const reportingSchema = pgSchema("reporting");

export const indicatorDefinitions = reportingSchema.table(
  "indicator_definitions",
  {
    id: idColumn,
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category").notNull(),
    numeratorLabel: text("numerator_label"),
    denominatorLabel: text("denominator_label"),
    unitLabel: text("unit_label").default("%"),
    periodicity: text("periodicity").notNull().default("MENSAL"),
    source: text("source"),
    calculationRule: text("calculation_rule"),
    ruleValidationStatus: text("rule_validation_status")
      .notNull()
      .default("PENDENTE_VALIDACAO"),
    owner: text("owner"),
    isActive: boolean("is_active").notNull().default(true),
    effectiveFrom: date("effective_from"),
    effectiveTo: date("effective_to"),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
  (t) => [
    uniqueIndex("indicator_code_uidx").on(t.code),
    index("indicator_category_idx").on(t.category),
  ],
);

export const indicatorTargets = reportingSchema.table(
  "indicator_targets",
  {
    id: idColumn,
    indicatorId: uuid("indicator_id")
      .notNull()
      .references(() => indicatorDefinitions.id),
    scopeLevel: text("scope_level").notNull().default("EMSERH"),
    regionId: uuid("region_id").references(() => regions.id),
    unitId: uuid("unit_id").references(() => units.id),
    periodMonth: date("period_month").notNull(),
    targetValue: doublePrecision("target_value"),
    ...timestamps,
    ...auditActors,
  },
  (t) => [
    index("indicator_targets_idx").on(t.indicatorId, t.periodMonth),
  ],
);

export const indicatorResults = reportingSchema.table(
  "indicator_results",
  {
    id: idColumn,
    indicatorId: uuid("indicator_id")
      .notNull()
      .references(() => indicatorDefinitions.id),
    scopeLevel: text("scope_level").notNull().default("EMSERH"),
    regionId: uuid("region_id").references(() => regions.id),
    unitId: uuid("unit_id").references(() => units.id),
    periodMonth: date("period_month").notNull(),
    numerator: doublePrecision("numerator"),
    denominator: doublePrecision("denominator"),
    resultValue: doublePrecision("result_value"),
    targetValue: doublePrecision("target_value"),
    isFrozen: boolean("is_frozen").notNull().default(false),
    calculationNotes: text("calculation_notes"),
    ruleValidationStatus: text("rule_validation_status"),
    ...timestamps,
    ...auditActors,
  },
  (t) => [
    uniqueIndex("indicator_results_uidx").on(
      t.indicatorId,
      t.scopeLevel,
      t.regionId,
      t.unitId,
      t.periodMonth,
    ),
    index("indicator_results_period_idx").on(t.periodMonth),
  ],
);
