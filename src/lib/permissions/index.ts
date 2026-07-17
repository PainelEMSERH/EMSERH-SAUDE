import type {
  PermissionAction,
  ResourceModule,
  ScopeLevel,
  SessionUser,
  UserRole,
} from "@/types";

type PermissionMatrix = Record<
  UserRole,
  Partial<Record<ResourceModule, PermissionAction[]>>
>;

const ALL: PermissionAction[] = [
  "view",
  "create",
  "update",
  "delete",
  "export",
  "manage",
  "view_clinical",
  "view_sensitive_identifiers",
  "sync_global",
];

const CLINICAL_OPS: PermissionAction[] = [
  "view",
  "create",
  "update",
  "export",
  "view_clinical",
];

const READ: PermissionAction[] = ["view"];
const READ_EXPORT: PermissionAction[] = ["view", "export"];

export const ROLE_PERMISSIONS: PermissionMatrix = {
  SUPER_ADMIN: {
    dashboard: ALL,
    employees: ALL,
    asos: ALL,
    agenda: ALL,
    leaves: ALL,
    vaccination: ALL,
    pregnancy: ALL,
    biological: ALL,
    attendances: ALL,
    indicators: ALL,
    reports: ALL,
    imports: ALL,
    admin: ALL,
    audit: ALL,
    files: ALL,
  },
  ADMIN_CENTRAL: {
    dashboard: ["view", "export"],
    employees: ["view", "create", "update", "export", "view_sensitive_identifiers"],
    asos: ["view", "create", "update", "export"],
    agenda: ["view", "create", "update", "export"],
    leaves: ["view", "create", "update", "export"],
    vaccination: ["view", "create", "update", "export"],
    pregnancy: ["view", "create", "update", "export"],
    biological: ["view", "create", "update", "export"],
    attendances: ["view", "create", "update", "export"],
    indicators: ["view", "update", "export", "manage"],
    reports: ["view", "export"],
    imports: ["view", "create", "manage", "sync_global"],
    admin: ["view", "create", "update", "manage"],
    audit: ["view", "export"],
    files: ["view", "create"],
  },
  COORDENACAO_REGIONAL: {
    dashboard: READ_EXPORT,
    employees: ["view", "create", "update", "export"],
    asos: ["view", "create", "update", "export"],
    agenda: ["view", "create", "update", "export"],
    leaves: ["view", "create", "update", "export"],
    vaccination: ["view", "create", "update", "export"],
    pregnancy: ["view", "create", "update", "export"],
    biological: ["view", "create", "update", "export"],
    attendances: ["view", "create", "update", "export"],
    indicators: READ_EXPORT,
    reports: READ_EXPORT,
    imports: ["view"],
    files: ["view", "create"],
  },
  OPERADOR_UNIDADE: {
    dashboard: READ,
    employees: ["view", "create", "update"],
    asos: ["view", "create", "update"],
    agenda: ["view", "create", "update"],
    leaves: ["view", "create", "update"],
    vaccination: ["view", "create", "update"],
    pregnancy: ["view", "create", "update"],
    biological: ["view", "create", "update"],
    attendances: ["view", "create", "update"],
    reports: READ,
    files: ["view", "create"],
  },
  MEDICO_TRABALHO: {
    dashboard: READ,
    employees: ["view", "view_clinical", "view_sensitive_identifiers"],
    asos: CLINICAL_OPS,
    agenda: CLINICAL_OPS,
    leaves: ["view", "create", "update", "view_clinical"],
    attendances: CLINICAL_OPS,
    files: ["view", "create", "view_clinical"],
  },
  ENFERMAGEM_TRABALHO: {
    dashboard: READ,
    employees: ["view", "update"],
    asos: ["view", "create", "update"],
    agenda: ["view", "create", "update"],
    leaves: ["view", "create", "update"],
    vaccination: CLINICAL_OPS,
    pregnancy: CLINICAL_OPS,
    biological: CLINICAL_OPS,
    attendances: ["view", "create", "update"],
    files: ["view", "create"],
  },
  GESTOR_CONSULTA: {
    dashboard: READ_EXPORT,
    employees: READ,
    asos: READ,
    agenda: READ,
    leaves: READ,
    vaccination: READ,
    pregnancy: READ,
    biological: READ,
    attendances: READ,
    indicators: READ_EXPORT,
    reports: READ_EXPORT,
  },
  AUDITOR: {
    dashboard: READ,
    employees: READ,
    asos: READ,
    agenda: READ,
    leaves: READ,
    vaccination: READ,
    pregnancy: READ,
    biological: READ,
    attendances: READ,
    indicators: READ,
    reports: READ,
    admin: READ,
    audit: ["view", "export"],
    files: READ,
  },
};

export function can(
  user: SessionUser | null | undefined,
  module: ResourceModule,
  action: PermissionAction,
): boolean {
  if (!user) return false;
  const allowed = ROLE_PERMISSIONS[user.role]?.[module] ?? [];
  return allowed.includes(action);
}

export function assertCan(
  user: SessionUser,
  module: ResourceModule,
  action: PermissionAction,
): void {
  if (!can(user, module, action)) {
    throw new Error("Acesso negado para esta operação.");
  }
}

export function scopeLevelForRole(role: UserRole): ScopeLevel {
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN_CENTRAL":
    case "GESTOR_CONSULTA":
    case "AUDITOR":
      return "EMSERH";
    case "COORDENACAO_REGIONAL":
      return "REGION";
    default:
      return "UNIT";
  }
}

export function filterByScope<T extends { regionId?: string | null; unitId?: string | null }>(
  user: SessionUser,
  rows: T[],
): T[] {
  if (user.scopeLevel === "EMSERH") return rows;
  if (user.scopeLevel === "REGION") {
    return rows.filter(
      (r) => r.regionId && user.regionIds.includes(r.regionId),
    );
  }
  return rows.filter((r) => r.unitId && user.unitIds.includes(r.unitId));
}
