import type { UserRole } from "@/types";

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "SUPER_ADMIN", label: "Super administrador" },
  { value: "ADMIN_CENTRAL", label: "Admin central" },
  { value: "COORDENACAO_REGIONAL", label: "Coordenação regional" },
  { value: "OPERADOR_UNIDADE", label: "Operador de unidade" },
  { value: "MEDICO_TRABALHO", label: "Médico do trabalho" },
  { value: "ENFERMAGEM_TRABALHO", label: "Enfermagem do trabalho" },
  { value: "GESTOR_CONSULTA", label: "Gestor (consulta)" },
  { value: "AUDITOR", label: "Auditor" },
];

export function roleLabel(role: string): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

/** Roles that a given actor may assign to others. */
export function assignableRoles(actorRole: UserRole): UserRole[] {
  if (actorRole === "SUPER_ADMIN") {
    return ROLE_OPTIONS.map((r) => r.value);
  }
  if (actorRole === "ADMIN_CENTRAL") {
    return ROLE_OPTIONS.map((r) => r.value).filter((r) => r !== "SUPER_ADMIN");
  }
  return [];
}
