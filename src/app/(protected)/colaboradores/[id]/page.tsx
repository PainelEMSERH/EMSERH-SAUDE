import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  AlertTriangle,
  ArrowLeft,
  Baby,
  Biohazard,
  CalendarDays,
  ClipboardList,
  Database,
  FileWarning,
  Syringe,
  UserRound,
} from "lucide-react";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDb } from "@/db";
import {
  appointments,
  asoRecords,
  biologicalAccidents,
  employeeVaccinations,
  leaveRecords,
  pregnancyCases,
} from "@/db/schemas";
import { getEmployeeById } from "@/db/queries/employees";
import { requirePermission, userCan } from "@/lib/auth/guard";
import { formatDateBR, formatDateTimeBR } from "@/lib/dates";
import { formatPhoneBR } from "@/lib/employees/cpf-display";
import {
  formatRegistrationDisplay,
  humanizeLabel,
  initialsFromName,
  toneForDeadlineStatus,
  toneForFunctionalStatus,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

export default async function ColaboradorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const user = await requirePermission("employees", "view");
  const { id } = await params;
  const { notice } = await searchParams;
  const data = await getEmployeeById(user, id);
  if (!data) notFound();

  const emp = data.employee;
  const canAsos = userCan(user, "asos", "view");
  const canAgenda = userCan(user, "agenda", "view");
  const canLeaves = userCan(user, "leaves", "view");
  const canVaccination = userCan(user, "vaccination", "view");
  const canPregnancy = userCan(user, "pregnancy", "view");
  const canBiological = userCan(user, "biological", "view");
  const canClinical =
    userCan(user, "employees", "view_clinical") ||
    userCan(user, "leaves", "view_clinical");

  const db = getDb();
  const [asos, leaves, appts, vaccines, pregnancies, accidents] =
    await Promise.all([
      canAsos
        ? db
            .select({
              id: asoRecords.id,
              asoType: asoRecords.asoType,
              lastAsoDate: asoRecords.lastAsoDate,
              nextAsoDate: asoRecords.nextAsoDate,
              deadlineStatus: asoRecords.deadlineStatus,
              sourceSheet: asoRecords.sourceSheet,
              updatedAt: asoRecords.updatedAt,
            })
            .from(asoRecords)
            .where(
              and(eq(asoRecords.employeeId, id), isNull(asoRecords.deletedAt)),
            )
            .orderBy(desc(asoRecords.nextAsoDate))
            .limit(20)
        : Promise.resolve([]),
      canLeaves
        ? db
            .select({
              id: leaveRecords.id,
              leaveType: leaveRecords.leaveType,
              startDate: leaveRecords.startDate,
              endDate: leaveRecords.endDate,
              status: leaveRecords.status,
              cidCode: canClinical
                ? leaveRecords.cidCode
                : sql<string | null>`null`,
            })
            .from(leaveRecords)
            .where(
              and(
                eq(leaveRecords.employeeId, id),
                isNull(leaveRecords.deletedAt),
              ),
            )
            .orderBy(desc(leaveRecords.startDate))
            .limit(20)
        : Promise.resolve([]),
      canAgenda
        ? db
            .select()
            .from(appointments)
            .where(
              and(
                eq(appointments.employeeId, id),
                isNull(appointments.deletedAt),
              ),
            )
            .orderBy(desc(appointments.scheduledAt))
            .limit(20)
        : Promise.resolve([]),
      canVaccination
        ? db
            .select()
            .from(employeeVaccinations)
            .where(
              and(
                eq(employeeVaccinations.employeeId, id),
                isNull(employeeVaccinations.deletedAt),
              ),
            )
            .orderBy(desc(employeeVaccinations.administeredAt))
            .limit(20)
        : Promise.resolve([]),
      canPregnancy
        ? db
            .select()
            .from(pregnancyCases)
            .where(
              and(
                eq(pregnancyCases.employeeId, id),
                isNull(pregnancyCases.deletedAt),
              ),
            )
            .orderBy(desc(pregnancyCases.createdAt))
            .limit(10)
        : Promise.resolve([]),
      canBiological
        ? db
            .select()
            .from(biologicalAccidents)
            .where(
              and(
                eq(biologicalAccidents.employeeId, id),
                isNull(biologicalAccidents.deletedAt),
              ),
            )
            .orderBy(desc(biologicalAccidents.occurredAt))
            .limit(10)
        : Promise.resolve([]),
    ]);

  const overdueAso = asos.find((a) => a.deadlineStatus === "VENCIDO");
  const sexLabel =
    emp.sex === "F" || emp.sex === "FEMININO"
      ? "Feminino"
      : emp.sex === "M" || emp.sex === "MASCULINO"
        ? "Masculino"
        : emp.sex
          ? humanizeLabel(emp.sex)
          : "—";

  return (
    <div className="space-y-3">
      <Link
        href="/colaboradores"
        className="inline-flex items-center gap-1 text-[12px] font-medium text-teal-800 hover:underline"
      >
        <ArrowLeft className="size-3.5" />
        Voltar para colaboradores
      </Link>

      {notice === "alterdata-edit" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
          Os dados cadastrais deste colaborador são atualizados pelo Alterdata.
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-teal-100 bg-teal-50 text-sm font-semibold text-teal-900">
              {initialsFromName(emp.fullName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-semibold text-slate-900">
                  {emp.fullName}
                </h2>
                <StatusBadge
                  label={humanizeLabel(emp.functionalStatus)}
                  tone={toneForFunctionalStatus(emp.functionalStatus)}
                />
              </div>
              <p className="mt-0.5 text-[13px] text-slate-500">
                Matrícula{" "}
                <span className="font-semibold text-teal-800">
                  {formatRegistrationDisplay(emp.registration)}
                </span>
                <span className="mx-1.5 text-slate-300">·</span>
                {humanizeLabel(data.unitName)}
                <span className="mx-1.5 text-slate-300">·</span>
                {humanizeLabel(data.regionName)}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1.5 text-[12px] lg:grid-cols-4">
                <Meta
                  label="Função"
                  value={data.jobRoleName ?? "—"}
                  clamp={2}
                  className="lg:col-span-1 min-w-0"
                />
                <Meta label="Admissão" value={formatDateBR(emp.admissionDate)} />
                <Meta label="Cidade" value={emp.city ?? "—"} />
                <Meta label="Telefone" value={formatPhoneBR(emp.phone)} />
              </dl>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
            <Database className="size-3.5 text-teal-700" aria-hidden />
            Dados sincronizados pelo Alterdata
          </span>
        </div>
      </div>

      {overdueAso ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-red-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-700" />
          <div>
            <p className="text-[13px] font-semibold">Alerta ocupacional</p>
            <p className="mt-0.5 text-[12px]">
              ASO {humanizeLabel(overdueAso.asoType).toLowerCase()} vencido
              desde {formatDateBR(overdueAso.nextAsoDate)}.
            </p>
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="cadastrais" className="gap-3">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-slate-100 p-1">
          <TabTrigger value="cadastrais">Dados cadastrais</TabTrigger>
          {canAsos ? (
            <TabTrigger value="asos" count={asos.length}>
              ASOs
            </TabTrigger>
          ) : null}
          {canAgenda ? (
            <TabTrigger value="agenda" count={appts.length}>
              Agenda
            </TabTrigger>
          ) : null}
          {canLeaves ? (
            <TabTrigger value="leaves" count={leaves.length}>
              Afastamentos
            </TabTrigger>
          ) : null}
          {canVaccination ? (
            <TabTrigger value="vacinas" count={vaccines.length}>
              Vacinas
            </TabTrigger>
          ) : null}
          {canPregnancy ? (
            <TabTrigger value="gestacao" count={pregnancies.length}>
              Gestação
            </TabTrigger>
          ) : null}
          {canBiological ? (
            <TabTrigger value="acidentes" count={accidents.length}>
              Acidentes
            </TabTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="cadastrais">
          <ModuleCard
            icon={<UserRound className="size-4" />}
            title="Dados cadastrais"
            description="Espelho oficial Alterdata — consulta completa."
          >
            <div className="space-y-2.5">
              <FieldGroup title="Identificação">
                <Meta
                  label="Matrícula"
                  value={formatRegistrationDisplay(emp.registration)}
                />
                <Meta
                  label="Nome completo"
                  value={emp.fullName}
                  className="md:col-span-2"
                  clamp={2}
                />
                <Meta label="CPF" value={data.cpfDisplay} />
                <Meta label="Sexo" value={sexLabel} />
                <Meta
                  label="Nascimento"
                  value={formatDateBR(emp.birthDate)}
                />
              </FieldGroup>

              <FieldGroup title="Vínculo">
                <Meta
                  label="Situação funcional"
                  value={humanizeLabel(emp.functionalStatus)}
                />
                <Meta
                  label="Função"
                  value={data.jobRoleName ?? "—"}
                  className="md:col-span-2"
                  clamp={2}
                />
                <Meta
                  label="Admissão"
                  value={formatDateBR(emp.admissionDate)}
                />
                {emp.dismissalDate ? (
                  <Meta
                    label="Demissão"
                    value={formatDateBR(emp.dismissalDate)}
                  />
                ) : null}
              </FieldGroup>

              <FieldGroup title="Lotação e contato">
                <Meta
                  label="Regional"
                  value={humanizeLabel(data.regionName)}
                />
                <Meta
                  label="Unidade"
                  value={humanizeLabel(data.unitName)}
                  className="md:col-span-2"
                  clamp={2}
                />
                <Meta label="Cidade" value={emp.city ?? "—"} />
                <Meta label="Telefone" value={formatPhoneBR(emp.phone)} />
              </FieldGroup>

              <div className="rounded-md border border-slate-100 bg-slate-50/70 px-3 py-2">
                <h4 className="mb-1.5 text-[10px] font-semibold tracking-wide text-teal-800 uppercase">
                  Origem dos dados
                </h4>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 md:grid-cols-4">
                  <Meta
                    label="Sistema de origem"
                    value={humanizeLabel(emp.sourceSystem) || "Alterdata"}
                  />
                  <Meta
                    label={
                      emp.sourceSystem?.includes("ALTERDATA")
                        ? "Última sincronização do Alterdata"
                        : "Última atualização do registro"
                    }
                    value={formatDateTimeBR(emp.updatedAt)}
                  />
                  <Meta
                    label="ID Alterdata"
                    value={emp.alterdataId ?? emp.registration}
                  />
                </dl>
              </div>
            </div>
          </ModuleCard>
        </TabsContent>

        {canAsos ? (
          <TabsContent value="asos">
            <ModuleCard
              icon={<ClipboardList className="size-4" />}
              title="ASOs"
              description="Exames ocupacionais e status de vencimento."
            >
              {asos.map((a) => (
                <RecordRow
                  key={a.id}
                  icon={<ClipboardList className="size-4 text-teal-700" />}
                  title={humanizeLabel(a.asoType)}
                  meta={
                    <span className="tabular-nums">
                      Último: {formatDateBR(a.lastAsoDate)} · Próximo:{" "}
                      {formatDateBR(a.nextAsoDate)}
                      {a.sourceSheet
                        ? ` · Origem: ${a.sourceSheet}`
                        : " · Origem: Alterdata"}
                      {a.updatedAt
                        ? ` · Sync: ${formatDateTimeBR(a.updatedAt)}`
                        : ""}
                    </span>
                  }
                  badge={
                    <StatusBadge
                      label={humanizeLabel(a.deadlineStatus)}
                      tone={toneForDeadlineStatus(a.deadlineStatus)}
                    />
                  }
                />
              ))}
              {!asos.length ? (
                <EmptyModule
                  icon={<ClipboardList className="size-5" />}
                  title="Nenhum ASO registrado"
                  description="Os exames ocupacionais deste colaborador aparecerão aqui."
                />
              ) : null}
            </ModuleCard>
          </TabsContent>
        ) : null}

        {canAgenda ? (
          <TabsContent value="agenda">
            <ModuleCard
              icon={<CalendarDays className="size-4" />}
              title="Agenda"
              description="Consultas e atendimentos agendados."
            >
              {appts.map((a) => (
                <RecordRow
                  key={a.id}
                  icon={<CalendarDays className="size-4 text-teal-700" />}
                  title={humanizeLabel(a.appointmentType)}
                  meta={
                    <span className="tabular-nums">
                      {formatDateTimeBR(a.scheduledAt)}
                    </span>
                  }
                  badge={
                    <StatusBadge
                      label={humanizeLabel(
                        a.presenceStatus ?? a.confirmationStatus,
                      )}
                      tone="muted"
                    />
                  }
                />
              ))}
              {!appts.length ? (
                <EmptyModule
                  icon={<CalendarDays className="size-5" />}
                  title="Nenhum agendamento"
                  description="Consultas e retornos médicos aparecerão nesta aba."
                />
              ) : null}
            </ModuleCard>
          </TabsContent>
        ) : null}

        {canLeaves ? (
          <TabsContent value="leaves">
            <ModuleCard
              icon={<FileWarning className="size-4" />}
              title="Afastamentos"
              description="Atestados, licenças e períodos de afastamento."
            >
              {leaves.map((l) => (
                <RecordRow
                  key={l.id}
                  icon={<FileWarning className="size-4 text-amber-700" />}
                  title={humanizeLabel(l.leaveType)}
                  meta={
                    <span>
                      <span className="tabular-nums">
                        {formatDateBR(l.startDate)} → {formatDateBR(l.endDate)}
                      </span>
                      {canClinical && l.cidCode ? ` · CID ${l.cidCode}` : ""}
                    </span>
                  }
                  badge={
                    <StatusBadge
                      label={humanizeLabel(l.status)}
                      tone={
                        l.status === "ATIVO"
                          ? "warn"
                          : l.status === "ENCERRADO"
                            ? "ok"
                            : "muted"
                      }
                    />
                  }
                />
              ))}
              {!leaves.length ? (
                <EmptyModule
                  icon={<FileWarning className="size-5" />}
                  title="Nenhum afastamento"
                  description="Registros de atestado e licença aparecerão aqui."
                />
              ) : null}
            </ModuleCard>
          </TabsContent>
        ) : null}

        {canVaccination ? (
          <TabsContent value="vacinas">
            <ModuleCard
              icon={<Syringe className="size-4" />}
              title="Vacinas"
              description="Doses aplicadas e situação vacinal importada."
            >
              {vaccines.map((v) => (
                <RecordRow
                  key={v.id}
                  icon={<Syringe className="size-4 text-teal-700" />}
                  title={`Dose ${v.doseNumber}`}
                  meta={
                    <span className="tabular-nums">
                      {formatDateBR(v.administeredAt)}
                    </span>
                  }
                  badge={
                    <StatusBadge
                      label={humanizeLabel(v.status)}
                      tone="muted"
                    />
                  }
                />
              ))}
              {!vaccines.length ? (
                <EmptyModule
                  icon={<Syringe className="size-5" />}
                  title="Nenhuma vacina registrada"
                  description="O histórico vacinal deste colaborador aparecerá aqui."
                />
              ) : null}
            </ModuleCard>
          </TabsContent>
        ) : null}

        {canPregnancy ? (
          <TabsContent value="gestacao">
            <ModuleCard
              icon={<Baby className="size-4" />}
              title="Gestação"
              description="Acompanhamento de gestantes e comunicação."
            >
              {pregnancies.map((p) => (
                <RecordRow
                  key={p.id}
                  icon={<Baby className="size-4 text-teal-700" />}
                  title={humanizeLabel(p.status)}
                  meta={
                    <span className="tabular-nums">
                      Comunicação {formatDateBR(p.communicationDate)}
                    </span>
                  }
                  badge={
                    <StatusBadge
                      label={humanizeLabel(p.status)}
                      tone="info"
                    />
                  }
                />
              ))}
              {!pregnancies.length ? (
                <EmptyModule
                  icon={<Baby className="size-5" />}
                  title="Nenhum acompanhamento gestacional"
                  description="Casos de gestação registrados aparecerão nesta aba."
                />
              ) : null}
            </ModuleCard>
          </TabsContent>
        ) : null}

        {canBiological ? (
          <TabsContent value="acidentes">
            <ModuleCard
              icon={<Biohazard className="size-4" />}
              title="Acidentes com material biológico"
              description="Ocorrências e status de acompanhamento."
            >
              {accidents.map((a) => (
                <RecordRow
                  key={a.id}
                  icon={<Biohazard className="size-4 text-red-700" />}
                  title={humanizeLabel(a.exposureType) || "Acidente"}
                  meta={
                    <span className="tabular-nums">
                      {formatDateBR(a.occurredAt)}
                    </span>
                  }
                  badge={
                    <StatusBadge
                      label={humanizeLabel(a.status)}
                      tone="warn"
                    />
                  }
                />
              ))}
              {!accidents.length ? (
                <EmptyModule
                  icon={<Biohazard className="size-5" />}
                  title="Nenhum acidente registrado"
                  description="Exposições a material biológico aparecerão aqui."
                />
              ) : null}
            </ModuleCard>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function TabTrigger({
  value,
  count,
  children,
}: {
  value: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      className="h-9 gap-2 px-3 text-[13px] data-active:bg-white data-active:text-teal-900 data-active:shadow-sm"
    >
      {children}
      {count != null ? (
        <span className="rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
          {count}
        </span>
      ) : null}
    </TabsTrigger>
  );
}

function Meta({
  label,
  value,
  clamp = 1,
  className,
}: {
  label: string;
  value: string;
  clamp?: 1 | 2;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </dt>
      <dd
        className={
          clamp === 2
            ? "line-clamp-2 text-[13px] font-medium break-words text-slate-900"
            : "truncate text-[13px] font-medium text-slate-900"
        }
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function FieldGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-1.5 text-[10px] font-semibold tracking-wide text-teal-800 uppercase">
        {title}
      </h4>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 md:grid-cols-3 lg:grid-cols-6">
        {children}
      </dl>
    </div>
  );
}

function ModuleCard({
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
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-start gap-2.5 border-b border-slate-100 pb-2.5">
        <div className="flex size-8 items-center justify-center rounded-md border border-teal-100 bg-teal-50 text-teal-800">
          {icon}
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
          <p className="text-[11px] text-slate-500">{description}</p>
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RecordRow({
  icon,
  title,
  meta,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  meta: React.ReactNode;
  badge: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-slate-900">
            {title}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">{meta}</p>
        </div>
      </div>
      <div className="shrink-0">{badge}</div>
    </div>
  );
}

function EmptyModule({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-4 py-5">
      <div className="text-slate-400">{icon}</div>
      <div>
        <p className="text-[13px] font-medium text-slate-800">{title}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
      </div>
    </div>
  );
}
