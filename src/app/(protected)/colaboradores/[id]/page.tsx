import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { PageHeader } from "@/components/feedback/setup-banner";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buttonVariants } from "@/components/ui/button";
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
import { formatDateBR } from "@/lib/dates";
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

  const defaultTab =
    (canAsos && "asos") ||
    (canAgenda && "agenda") ||
    (canLeaves && "leaves") ||
    (canVaccination && "vacinas") ||
    (canPregnancy && "gestacao") ||
    (canBiological && "acidentes") ||
    null;

  return (
    <div>
      <PageHeader
        title={emp.fullName}
        description={`Matrícula ${emp.registration} · ${data.unitName ?? "Sem unidade"} · ${data.regionName ?? "Sem regional"}`}
        actions={
          canUpdate ? (
            <Link
              href={`/colaboradores/${id}/editar`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Editar
            </Link>
          ) : null
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Info label="Função" value={data.jobRoleName ?? "—"} />
        <Info label="Situação" value={emp.functionalStatus} />
        <Info label="Admissão" value={formatDateBR(emp.admissionDate)} />
        <Info label="Cidade" value={emp.city ?? "—"} />
      </div>

      {!defaultTab ? (
        <p className="text-sm text-slate-500">
          Sem permissão para visualizar módulos operacionais neste prontuário.
        </p>
      ) : (
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            {canAsos ? (
              <TabsTrigger value="asos">ASOs ({asos.length})</TabsTrigger>
            ) : null}
            {canAgenda ? (
              <TabsTrigger value="agenda">Agenda ({appts.length})</TabsTrigger>
            ) : null}
            {canLeaves ? (
              <TabsTrigger value="leaves">
                Afastamentos ({leaves.length})
              </TabsTrigger>
            ) : null}
            {canVaccination ? (
              <TabsTrigger value="vacinas">
                Vacinas ({vaccines.length})
              </TabsTrigger>
            ) : null}
            {canPregnancy ? (
              <TabsTrigger value="gestacao">
                Gestação ({pregnancies.length})
              </TabsTrigger>
            ) : null}
            {canBiological ? (
              <TabsTrigger value="acidentes">
                Acidentes ({accidents.length})
              </TabsTrigger>
            ) : null}
          </TabsList>
          {canAsos ? (
            <TabsContent value="asos" className="space-y-2">
              {asos.map((a) => (
                <Row
                  key={a.id}
                  title={a.asoType}
                  meta={`${formatDateBR(a.nextAsoDate)} · ${a.deadlineStatus ?? "—"}`}
                />
              ))}
              {!asos.length ? <Empty /> : null}
            </TabsContent>
          ) : null}
          {canAgenda ? (
            <TabsContent value="agenda" className="space-y-2">
              {appts.map((a) => (
                <Row
                  key={a.id}
                  title={a.appointmentType}
                  meta={`${formatDateBR(a.scheduledAt)} · ${a.presenceStatus ?? a.confirmationStatus ?? "—"}`}
                />
              ))}
              {!appts.length ? <Empty /> : null}
            </TabsContent>
          ) : null}
          {canLeaves ? (
            <TabsContent value="leaves" className="space-y-2">
              {leaves.map((l) => (
                <Row
                  key={l.id}
                  title={l.leaveType}
                  meta={`${formatDateBR(l.startDate)} → ${formatDateBR(l.endDate)} · ${l.status}${
                    canClinical && l.cidCode ? ` · CID ${l.cidCode}` : ""
                  }`}
                />
              ))}
              {!leaves.length ? <Empty /> : null}
            </TabsContent>
          ) : null}
          {canVaccination ? (
            <TabsContent value="vacinas" className="space-y-2">
              {vaccines.map((v) => (
                <Row
                  key={v.id}
                  title={`Dose ${v.doseNumber}`}
                  meta={`${formatDateBR(v.administeredAt)} · ${v.status}`}
                />
              ))}
              {!vaccines.length ? <Empty /> : null}
            </TabsContent>
          ) : null}
          {canPregnancy ? (
            <TabsContent value="gestacao" className="space-y-2">
              {pregnancies.map((p) => (
                <Row
                  key={p.id}
                  title={p.status}
                  meta={`Comunicação ${formatDateBR(p.communicationDate)}`}
                />
              ))}
              {!pregnancies.length ? <Empty /> : null}
            </TabsContent>
          ) : null}
          {canBiological ? (
            <TabsContent value="acidentes" className="space-y-2">
              {accidents.map((a) => (
                <Row
                  key={a.id}
                  title={a.exposureType ?? "Acidente"}
                  meta={`${formatDateBR(a.occurredAt)} · ${a.status}`}
                />
              ))}
              {!accidents.length ? <Empty /> : null}
            </TabsContent>
          ) : null}
        </Tabs>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function Row({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-slate-500">{meta}</p>
      </div>
      <StatusBadge label="registro" tone="muted" />
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-slate-500">Sem registros neste módulo.</p>;
}
