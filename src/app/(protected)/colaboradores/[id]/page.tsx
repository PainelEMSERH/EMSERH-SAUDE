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
  FileWarning,
  Pencil,
  Syringe,
} from "lucide-react";
import { StatusBadge } from "@/components/feedback/status-badge";
import { buttonVariants } from "@/components/ui/button";
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
import {
  humanizeLabel,
  initialsFromName,
  toneForDeadlineStatus,
  toneForFunctionalStatus,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

export default async function ColaboradorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("employees", "view");
  const { id } = await params;
  const data = await getEmployeeById(user, id);
  if (!data) notFound();

  const emp = data.employee;
  const canUpdate = userCan(user, "employees", "update");
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
              nextAsoDate: asoRecords.nextAsoDate,
              deadlineStatus: asoRecords.deadlineStatus,
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
  const defaultTab =
    (canAsos && "asos") ||
    (canAgenda && "agenda") ||
    (canLeaves && "leaves") ||
    (canVaccination && "vacinas") ||
    (canPregnancy && "gestacao") ||
    (canBiological && "acidentes") ||
    null;

  return (
    <div className="space-y-3">
      <Link
        href="/colaboradores"
        className="inline-flex items-center gap-1 text-[12px] font-medium text-teal-800 hover:underline"
      >
        <ArrowLeft className="size-3.5" />
        Voltar para colaboradores
      </Link>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-teal-100 bg-teal-50 text-sm font-semibold text-teal-900">
              {initialsFromName(emp.fullName)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-semibold text-slate-900">
                  {emp.fullName}
                </h2>
                <StatusBadge
                  label={humanizeLabel(emp.functionalStatus)}
                  tone={toneForFunctionalStatus(emp.functionalStatus)}
                />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Matrícula{" "}
                <span className="font-semibold text-teal-800">
                  {emp.registration}
                </span>
              </p>
              <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <Meta label="Função" value={data.jobRoleName ?? "—"} />
                <Meta
                  label="Unidade"
                  value={humanizeLabel(data.unitName)}
                />
                <Meta
                  label="Regional"
                  value={humanizeLabel(data.regionName)}
                />
                <Meta
                  label="Admissão"
                  value={formatDateBR(emp.admissionDate)}
                />
                <Meta label="Cidade" value={emp.city ?? "—"} />
                {emp.phone ? <Meta label="Telefone" value={emp.phone} /> : null}
              </dl>
            </div>
          </div>
          {canUpdate ? (
            <Link
              href={`/colaboradores/${id}/editar`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-8 shrink-0 gap-1.5 text-[13px]",
              )}
            >
              <Pencil className="size-3.5" />
              Editar colaborador
            </Link>
          ) : null}
        </div>
      </div>

      {overdueAso ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-700" />
          <div>
            <p className="text-sm font-semibold">Alerta ocupacional</p>
            <p className="mt-0.5 text-sm">
              ASO {humanizeLabel(overdueAso.asoType).toLowerCase()} vencido
              desde {formatDateBR(overdueAso.nextAsoDate)}.
            </p>
          </div>
        </div>
      ) : null}

      {!defaultTab ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          Sem permissão para visualizar módulos operacionais neste prontuário.
        </p>
      ) : (
        <Tabs defaultValue={defaultTab} className="gap-4">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-slate-100 p-1.5">
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
                        Próximo: {formatDateBR(a.nextAsoDate)}
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
                          {formatDateBR(l.startDate)} →{" "}
                          {formatDateBR(l.endDate)}
                        </span>
                        {canClinical && l.cidCode
                          ? ` · CID ${l.cidCode}`
                          : ""}
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
      )}
    </div>
  );
}

function TabTrigger({
  value,
  count,
  children,
}: {
  value: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      className="h-10 gap-2 px-3 text-sm data-active:bg-white data-active:text-teal-900 data-active:shadow-sm"
    >
      {children}
      <span className="rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 data-active:bg-teal-100 data-active:text-teal-900">
        {count}
      </span>
    </TabsTrigger>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="truncate font-medium text-slate-900" title={value}>
        {value}
      </dd>
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start gap-3 border-b border-slate-100 pb-3">
        <div className="flex size-9 items-center justify-center rounded-lg border border-teal-100 bg-teal-50 text-teal-800">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">{description}</p>
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
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{title}</p>
          <p className="mt-0.5 text-xs text-slate-500">{meta}</p>
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
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6">
      <div className="text-slate-400">{icon}</div>
      <div>
        <p className="text-sm font-medium text-slate-800">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}
