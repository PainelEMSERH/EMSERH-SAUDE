export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN_CENTRAL"
  | "COORDENACAO_REGIONAL"
  | "OPERADOR_UNIDADE"
  | "MEDICO_TRABALHO"
  | "ENFERMAGEM_TRABALHO"
  | "GESTOR_CONSULTA"
  | "AUDITOR";

export type PermissionAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "export"
  | "manage"
  | "view_clinical"
  | "view_sensitive_identifiers"
  | "sync_global";

export type ResourceModule =
  | "dashboard"
  | "employees"
  | "asos"
  | "agenda"
  | "leaves"
  | "vaccination"
  | "pregnancy"
  | "biological"
  | "attendances"
  | "indicators"
  | "reports"
  | "imports"
  | "admin"
  | "audit"
  | "files";

export type ScopeLevel = "EMSERH" | "REGION" | "UNIT";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  scopeLevel: ScopeLevel;
  regionIds: string[];
  unitIds: string[];
};

export type AsoType =
  | "ADMISSIONAL"
  | "PERIODICO"
  | "RETORNO_TRABALHO"
  | "MUDANCA_RISCO"
  | "DEMISSIONAL";

export type AsoResult = "APTO" | "INAPTO" | "APTO_COM_RESTRICAO";

export type DeadlineStatus =
  | "EM_DIA"
  | "A_VENCER"
  | "VENCIDO"
  | "NAO_APLICAVEL";
