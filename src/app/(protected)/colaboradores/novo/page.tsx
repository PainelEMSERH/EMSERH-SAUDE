import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
    <div className="space-y-5">
      <Link
        href="/colaboradores"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-800 hover:underline"
      >
        <ArrowLeft className="size-4" />
        Voltar para colaboradores
      </Link>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Novo colaborador
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Cadastro manual com escopo institucional.
        </p>
      </div>
      <EmployeeForm
        mode="create"
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
