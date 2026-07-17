import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
    <div className="space-y-5">
      <Link
        href={`/colaboradores/${id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-800 hover:underline"
      >
        <ArrowLeft className="size-4" />
        Voltar para o prontuário
      </Link>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Editar colaborador
        </h2>
        <p className="mt-1 text-sm text-slate-500">{emp.fullName}</p>
      </div>
      <EmployeeForm
        mode="edit"
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
