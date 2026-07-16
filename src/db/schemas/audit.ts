import {
  index,
  jsonb,
  pgSchema,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { idColumn, timestamps } from "./common";

export const auditSchema = pgSchema("audit");

export const auditLogs = auditSchema.table(
  "audit_logs",
  {
    id: idColumn,
    userId: uuid("user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    beforeData: jsonb("before_data"),
    afterData: jsonb("after_data"),
    metadata: jsonb("metadata"),
    ...timestamps,
  },
  (t) => [
    index("audit_user_idx").on(t.userId),
    index("audit_entity_idx").on(t.entityType, t.entityId),
    index("audit_action_idx").on(t.action),
    index("audit_created_idx").on(t.createdAt),
  ],
);
