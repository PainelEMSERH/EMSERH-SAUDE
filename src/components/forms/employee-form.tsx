"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Briefcase,
  IdCard,
  Loader2,
  MapPin,
  Phone,
} from "lucide-react";
import {
  upsertEmployeeAction,
  type ActionState,
} from "@/actions/employees";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUnitDisplayName } from "@/lib/labels";
import { cn } from "@/lib/utils";

const initial: ActionState = {};
const NEW_JOB_ROLE = "__NEW__";

type Opt = { id: string; name: string };

const fieldClass =
  "h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-[13px] outline-none transition-colors focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/20";

export function EmployeeForm({
  regions,
  units,
  jobRoles,
  defaults,
  mode = "create",
}: {
  regions: Opt[];
  units: Array<Opt & { regionId: string | null }>;
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
  mode?: "create" | "edit";
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(upsertEmployeeAction, initial);
  const [regionId, setRegionId] = useState(defaults?.regionId ?? "");
  const [unitId, setUnitId] = useState(defaults?.unitId ?? "");
  const [jobRoleChoice, setJobRoleChoice] = useState(
    defaults?.jobRoleId ?? "",
  );

  const filteredUnits = useMemo(() => {
    if (!regionId) return units;
    return units.filter((u) => u.regionId === regionId);
  }, [units, regionId]);

  useEffect(() => {
    if (!unitId) return;
    const stillValid = filteredUnits.some((u) => u.id === unitId);
    if (!stillValid) setUnitId("");
  }, [filteredUnits, unitId]);

  useEffect(() => {
    if (state.ok && state.id) {
      toast.success(
        mode === "edit"
          ? "Alterações salvas com sucesso."
          : "Colaborador cadastrado com sucesso.",
      );
      router.push(`/colaboradores/${state.id}`);
      router.refresh();
    }
  }, [state, router, mode]);

  const cancelHref =
    mode === "edit" && defaults?.id
      ? `/colaboradores/${defaults.id}`
      : "/colaboradores";

  return (
    <form action={action} className="mx-auto max-w-3xl space-y-3">
      {defaults?.id ? (
        <input type="hidden" name="id" value={defaults.id} />
      ) : null}

      <Section
        icon={<IdCard className="size-4" />}
        title="Identificação"
        description="Dados básicos do colaborador no cadastro institucional."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Matrícula" htmlFor="registration" required>
            <Input
              id="registration"
              name="registration"
              required
              className="h-8"
              placeholder="Ex.: 012345"
              defaultValue={defaults?.registration ?? ""}
            />
          </Field>
          <Field label="Nome completo" htmlFor="fullName" required>
            <Input
              id="fullName"
              name="fullName"
              required
              className="h-8"
              placeholder="Nome completo"
              defaultValue={defaults?.fullName ?? ""}
            />
          </Field>
          <Field label="CPF" htmlFor="cpf">
            <Input
              id="cpf"
              name="cpf"
              className="h-8"
              placeholder={
                mode === "edit"
                  ? "Informe apenas para alterar"
                  : "Somente dígitos"
              }
              inputMode="numeric"
              autoComplete="off"
            />
            {mode === "edit" ? (
              <p className="mt-1.5 text-xs text-slate-500">
                O CPF cadastrado permanece protegido. Deixe em branco para
                manter o atual.
              </p>
            ) : null}
          </Field>
          <Field label="Sexo" htmlFor="sex">
            <select
              id="sex"
              name="sex"
              defaultValue={defaults?.sex ?? ""}
              className={fieldClass}
            >
              <option value="">—</option>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section
        icon={<Briefcase className="size-4" />}
        title="Lotação e vínculo"
        description="Regional, unidade, função e situação funcional."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Regional" htmlFor="regionId">
            <select
              id="regionId"
              name="regionId"
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              className={fieldClass}
            >
              <option value="">—</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Unidade" htmlFor="unitId">
            <select
              id="unitId"
              name="unitId"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className={fieldClass}
            >
              <option value="">—</option>
              {filteredUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {formatUnitDisplayName(u.name)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Função" htmlFor="jobRoleId">
            <select
              id="jobRoleId"
              name="jobRoleId"
              value={jobRoleChoice}
              onChange={(e) => setJobRoleChoice(e.target.value)}
              className={fieldClass}
            >
              <option value="">—</option>
              {jobRoles.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
              <option value={NEW_JOB_ROLE}>Cadastrar nova função</option>
            </select>
          </Field>
          {jobRoleChoice === NEW_JOB_ROLE ? (
            <Field label="Nova função" htmlFor="jobRoleName" required>
              <Input
                id="jobRoleName"
                name="jobRoleName"
                required
                className="h-8"
                placeholder="Digite o nome da função"
              />
            </Field>
          ) : (
            <input type="hidden" name="jobRoleName" value="" />
          )}
          <Field label="Situação funcional" htmlFor="functionalStatus" required>
            <select
              id="functionalStatus"
              name="functionalStatus"
              defaultValue={defaults?.functionalStatus ?? "ATIVO"}
              className={fieldClass}
              required
            >
              <option value="ATIVO">Ativo</option>
              <option value="AFASTADO">Afastado</option>
              <option value="DEMITIDO">Demitido</option>
              <option value="FERIAS">Férias</option>
            </select>
          </Field>
          <Field label="Data de admissão" htmlFor="admissionDate">
            <Input
              id="admissionDate"
              name="admissionDate"
              type="date"
              className="h-8"
              defaultValue={defaults?.admissionDate ?? ""}
            />
          </Field>
        </div>
      </Section>

      <Section
        icon={<Phone className="size-4" />}
        title="Contato"
        description="Informações de contato e localização."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telefone" htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              className="h-8"
              inputMode="tel"
              placeholder="(98) 90000-0000"
              defaultValue={defaults?.phone ?? ""}
            />
          </Field>
          <Field label="Cidade" htmlFor="city">
            <div className="relative">
              <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="city"
                name="city"
                className="h-8 pl-8"
                placeholder="Cidade"
                defaultValue={defaults?.city ?? ""}
              />
            </div>
          </Field>
        </div>
      </Section>

      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Link
          href={cancelHref}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 text-[13px]")}
        >
          Cancelar
        </Link>
        <Button
          type="submit"
          disabled={pending}
          size="sm"
          className="h-8 min-w-[160px] gap-1.5 bg-teal-700 text-[13px] hover:bg-teal-800"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {pending
            ? "Salvando..."
            : mode === "edit"
              ? "Salvar alterações"
              : "Cadastrar colaborador"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-start gap-2.5 border-b border-slate-100 pb-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-teal-100 bg-teal-50 text-teal-800">
          {icon}
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm text-slate-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}
