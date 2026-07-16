import {
  bigint,
  index,
  integer,
  pgSchema,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { auditActors, idColumn, softDelete, timestamps } from "./common";

export const filesSchema = pgSchema("files");

export const attachments = filesSchema.table(
  "attachments",
  {
    id: idColumn,
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    originalName: text("original_name").notNull(),
    pathname: text("pathname").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    contentHash: text("content_hash").notNull(),
    category: text("category").notNull(),
    status: text("status").notNull().default("ACTIVE"),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
  (t) => [
    index("attachments_entity_idx").on(t.entityType, t.entityId),
    index("attachments_pathname_idx").on(t.pathname),
  ],
);

export const importBatches = filesSchema.table(
  "import_batches",
  {
    id: idColumn,
    sourceName: text("source_name").notNull(),
    status: text("status").notNull().default("PENDING"),
    totalRows: integer("total_rows").default(0),
    importedRows: integer("imported_rows").default(0),
    updatedRows: integer("updated_rows").default(0),
    skippedRows: integer("skipped_rows").default(0),
    duplicateRows: integer("duplicate_rows").default(0),
    errorRows: integer("error_rows").default(0),
    reportSummary: text("report_summary"),
    ...timestamps,
    ...auditActors,
  },
  (t) => [index("import_batches_status_idx").on(t.status)],
);

export const importFiles = filesSchema.table("import_files", {
  id: idColumn,
  batchId: uuid("batch_id")
    .notNull()
    .references(() => importBatches.id),
  fileName: text("file_name").notNull(),
  fileHash: text("file_hash").notNull(),
  sheetName: text("sheet_name"),
  ...timestamps,
});

export const importRows = filesSchema.table(
  "import_rows",
  {
    id: idColumn,
    batchId: uuid("batch_id")
      .notNull()
      .references(() => importBatches.id),
    sheetName: text("sheet_name"),
    rowNumber: integer("row_number").notNull(),
    status: text("status").notNull(),
    sourcePayload: text("source_payload"),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    message: text("message"),
    ...timestamps,
  },
  (t) => [index("import_rows_batch_idx").on(t.batchId, t.status)],
);

export const importErrors = filesSchema.table(
  "import_errors",
  {
    id: idColumn,
    batchId: uuid("batch_id")
      .notNull()
      .references(() => importBatches.id),
    rowNumber: integer("row_number"),
    field: text("field"),
    message: text("message").notNull(),
    rawValue: text("raw_value"),
    ...timestamps,
  },
  (t) => [index("import_errors_batch_idx").on(t.batchId)],
);

export const importMappings = filesSchema.table("import_mappings", {
  id: idColumn,
  sourceName: text("source_name").notNull(),
  sheetName: text("sheet_name").notNull(),
  sourceColumn: text("source_column").notNull(),
  targetField: text("target_field").notNull(),
  transform: text("transform"),
  ...timestamps,
});
