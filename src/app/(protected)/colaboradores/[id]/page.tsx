import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
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
  const db = getDb();
  const [asos, leaves, appts, vaccines, pregnancies, accidents] =
    await Promise.all([
      db
        .select()
        .from(asoRecords)
        .where(and(eq(asoRecords.employeeId, id), isNull(asoRecords.deletedAt)))
        .orderBy(desc(asoRecords.nextAsoDate))
        .limit(20),
      db
        .select()
        .from(leaveRecords)
        .where(and(eq(leaveRecords.employeeId, id), isNull(leaveRecords.deletedAt)))
        .orderBy(desc(leaveRecords.startDate))
        .limit(20),
      db
        .select()
        .from(appointments)
        .where(and(eq(appointments.employeeId, id), isNull(appointments.deletedAt)))
        .orderBy(desc(appointments.scheduledAt))
        .limit(20),
      db
        .select()
        .from(employeeVaccinations)
        .where(
          and(
            eq(employeeVaccinations.employeeId, id),
            isNull(employeeVaccinations.deletedAt),
          ),
        )
        .orderBy(desc(employeeVaccinations.administeredAt))
        .limit(20),
      db
        .select()
        .from(pregnancyCases)
        .where(
          and(eq(pregnancyCases.employeeId, id), isNull(pregnancyCases.deletedAt)),
        )
        .orderBy(desc(pregnancyCases.createdAt))
        .limit(10),
      db
        .select()
        .from(biologicalAccidents)
        .where(
          and(
            eq(biologicalAccidents.employeeId, id),
            isNull(biologicalAccidents.deletedAt),
          ),
        )
        .orderBy(desc(biologicalAccidents.occurredAt))
        .limit(10),
    ]);

  const canUpdate = userCan(user, "employees", "update");

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

      <Tabs defaultValue="asos">
        <TabsList>
          <TabsTrigger value="asos">ASOs ({asos.length})</TabsTrigger>
          <TabsTrigger value="agenda">Agenda ({appts.length})</TabsTrigger>
          <TabsTrigger value="leaves">Afastamentos ({leaves.length})</TabsTrigger>
          <TabsTrigger value="vacinas">Vacinas ({vaccines.length})</TabsTrigger>
          <TabsTrigger value="gestacao">Gestação ({pregnancies.length})</TabsTrigger>
          <TabsTrigger value="acidentes">Acidentes ({accidents.length})</TabsTrigger>
        </TabsList>
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
        <TabsContent value="leaves" className="space-y-2">
          {leaves.map((l) => (
            <Row
              key={l.id}
              title={l.leaveType}
              meta={`${formatDateBR(l.startDate)} → ${formatDateBR(l.endDate)} · ${l.status}`}
            />
          ))}
          {!leaves.length ? <Empty /> : null}
        </TabsContent>
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
      </Tabs>
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
