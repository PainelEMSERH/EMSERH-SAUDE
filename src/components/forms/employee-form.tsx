"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  upsertEmployeeAction,
  type ActionState,
} from "@/actions/employees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ActionState = {};

type Opt = { id: string; name: string };

export function EmployeeForm({
  regions,
  units,
  jobRoles,
  defaults,
}: {
  regions: Opt[];
  units: Array<Opt & { regionId: string }>;
  jobRoles: Opt[];
  defaults?: {
    id?: string;
    registration?: string;
    fullName?: string;
    sex?: string | null;
    phone?: string | null;
    city?: string | null;
    admissionDate?: string | null;
    functionalStatus?: string;
    regionId?: string | null;
    unitId?: string | null;
    jobRoleId?: string | null;
  };
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(upsertEmployeeAction, initial);

  useEffect(() => {
    if (state.ok && state.id) {
      router.push(`/colaboradores/${state.id}`);
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="registration">Matrícula</Label>
          <Input
            id="registration"
            name="registration"
            required
            defaultValue={defaults?.registration ?? ""}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fullName">Nome completo</Label>
          <Input
            id="fullName"
            name="fullName"
            required
            defaultValue={defaults?.fullName ?? ""}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cpf">CPF</Label>
          <Input id="cpf" name="cpf" placeholder="somente dígitos" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="functionalStatus">Situação</Label>
          <select
            id="functionalStatus"
            name="functionalStatus"
            defaultValue={defaults?.functionalStatus ?? "ATIVO"}
            className="h-8 w-full rounded-lg border border-slate-200 px-2 text-sm"
          >
            <option value="ATIVO">Ativo</option>
            <option value="AFASTADO">Afastado</option>
            <option value="DEMITIDO">Demitido</option>
            <option value="FERIAS">Férias</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="regionId">Regional</Label>
          <select
            id="regionId"
            name="regionId"
            defaultValue={defaults?.regionId ?? ""}
            className="h-8 w-full rounded-lg border border-slate-200 px-2 text-sm"
          >
            <option value="">—</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="unitId">Unidade</Label>
          <select
            id="unitId"
            name="unitId"
            defaultValue={defaults?.unitId ?? ""}
            className="h-8 w-full rounded-lg border border-slate-200 px-2 text-sm"
          >
            <option value="">—</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="jobRoleId">Função cadastrada</Label>
          <select
            id="jobRoleId"
            name="jobRoleId"
            defaultValue={defaults?.jobRoleId ?? ""}
            className="h-8 w-full rounded-lg border border-slate-200 px-2 text-sm"
          >
            <option value="">—</option>
            {jobRoles.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="jobRoleName">Ou nova função</Label>
          <Input id="jobRoleName" name="jobRoleName" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="admissionDate">Admissão</Label>
          <Input
            id="admissionDate"
            name="admissionDate"
            type="date"
            defaultValue={defaults?.admissionDate ?? ""}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sex">Sexo</Label>
          <select
            id="sex"
            name="sex"
            defaultValue={defaults?.sex ?? ""}
            className="h-8 w-full rounded-lg border border-slate-200 px-2 text-sm"
          >
            <option value="">—</option>
            <option value="F">Feminino</option>
            <option value="M">Masculino</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" name="phone" defaultValue={defaults?.phone ?? ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="city">Cidade</Label>
          <Input id="city" name="city" defaultValue={defaults?.city ?? ""} />
        </div>
      </div>
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="bg-teal-700 hover:bg-teal-800">
        {pending ? "Salvando..." : "Salvar colaborador"}
      </Button>
    </form>
  );
}
