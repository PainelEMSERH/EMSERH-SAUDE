import { PageHeader } from "@/components/feedback/setup-banner";
import { EmployeeForm } from "@/components/forms/employee-form";
import { requirePermission } from "@/lib/auth/guard";
import {
  ensureOrgDefaults,
  listJobRoles,
  listRegions,
  listUnits,
} from "@/db/queries/employees";

export default async function NovoColaboradorPage() {
  const user = await requirePermission("employees", "create");
  await ensureOrgDefaults(user.id);
  const [regions, units, jobRoles] = await Promise.all([
    listRegions(),
    listUnits(),
    listJobRoles(),
  ]);

  return (
    <div>
      <PageHeader
        title="Novo colaborador"
        description="Cadastro manual com escopo institucional."
      />
      <EmployeeForm
        regions={regions.map((r) => ({ id: r.id, name: r.name }))}
        units={units.map((u) => ({
          id: u.id,
          name: u.name,
          regionId: u.regionId,
        }))}
        jobRoles={jobRoles.map((j) => ({ id: j.id, name: j.name }))}
      />
    </div>
  );
}
