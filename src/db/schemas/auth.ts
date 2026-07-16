import {
  boolean,
  index,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { auditActors, idColumn, softDelete, timestamps } from "./common";

export const authSchema = pgSchema("auth");

export const users = authSchema.table(
  "users",
  {
    id: idColumn,
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull(),
    scopeLevel: text("scope_level").notNull().default("UNIT"),
    isActive: boolean("is_active").notNull().default(true),
    mustResetPassword: boolean("must_reset_password").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
    ...softDelete,
    ...auditActors,
  },
  (t) => [
    uniqueIndex("users_email_uidx").on(t.email),
    index("users_role_idx").on(t.role),
  ],
);

export const userRegionScopes = authSchema.table(
  "user_region_scopes",
  {
    id: idColumn,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    regionId: uuid("region_id").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("user_region_uidx").on(t.userId, t.regionId),
    index("user_region_user_idx").on(t.userId),
  ],
);

export const userUnitScopes = authSchema.table(
  "user_unit_scopes",
  {
    id: idColumn,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    unitId: uuid("unit_id").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("user_unit_uidx").on(t.userId, t.unitId),
    index("user_unit_user_idx").on(t.userId),
  ],
);

export const sessions = authSchema.table(
  "sessions",
  {
    id: idColumn,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("sessions_token_uidx").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
    index("sessions_expires_idx").on(t.expiresAt),
  ],
);

export const loginAttempts = authSchema.table(
  "login_attempts",
  {
    id: idColumn,
    email: text("email").notNull(),
    success: boolean("success").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    reason: text("reason"),
    ...timestamps,
  },
  (t) => [
    index("login_attempts_email_idx").on(t.email),
    index("login_attempts_created_idx").on(t.createdAt),
  ],
);

export const rolePermissions = authSchema.table(
  "role_permissions",
  {
    id: idColumn,
    role: text("role").notNull(),
    module: text("module").notNull(),
    action: text("action").notNull(),
    allowed: boolean("allowed").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("role_perm_uidx").on(t.role, t.module, t.action),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
