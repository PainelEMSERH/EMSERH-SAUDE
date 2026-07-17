import { notFound } from "next/navigation";
import { PageHeader } from "@/components/feedback/setup-banner";
import { EmployeeForm } from "@/components/forms/employee-form";
import { requirePermission } from "@/lib/auth/guard";
import {
  getEmployeeById,
  listJobRoles,
  listRegions,
  listUnits,
} from "@/db/queries/employees";

export default async function EditarColaboradorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("employees", "update");
  const { id } = await params;
  const data = await getEmployeeById(user, id);
  if (!data) notFound();

  const [regions, units, jobRoles] = await Promise.all([
    listRegions(),
    listUnits(),
    listJobRoles(),
  ]);
  const emp = data.employee;

  return (
    <div>
      <PageHeader title="Editar colaborador" description={emp.fullName} />
      <EmployeeForm
        regions={regions.map((r) => ({ id: r.id, name: r.name }))}
        units={units.map((u) => ({
          id: u.id,
          name: u.name,
          regionId: u.regionId,
        }))}
        jobRoles={jobRoles.map((j) => ({ id: j.id, name: j.name }))}
        defaults={{
          id: emp.id,
          registration: emp.registration,
          fullName: emp.fullName,
          sex: emp.sex,
          phone: emp.phone,
          city: emp.city,
          admissionDate: emp.admissionDate,
          functionalStatus: emp.functionalStatus,
          regionId: emp.regionId,
          unitId: emp.unitId,
          jobRoleId: emp.jobRoleId,
        }}
      />
    </div>
  );
}
