import { ClipboardPlus } from "lucide-react";
import { ClinicAsoWorkspace } from "@/components/clinic-aso/clinic-aso-workspace";
import { requirePermission } from "@/lib/auth/guard";
import {
  ensureDefaultClinicPhysicians,
  listClinicAttendances,
  listClinicPhysicians,
} from "@/db/queries/clinic-aso";
import { clinicIntegrationsStatus } from "@/lib/clinic-aso/env";

export const dynamic = "force-dynamic";

export default async function AtendimentoAsoPage() {
  await requirePermission("attendances", "view");

  let physicians: Awaited<ReturnType<typeof listClinicPhysicians>> = [];
  let attendances: Awaited<ReturnType<typeof listClinicAttendances>> = [];
  let dbError: string | null = null;

  try {
    await ensureDefaultClinicPhysicians();
    physicians = await listClinicPhysicians();
    attendances = await listClinicAttendances(200);
  } catch (e) {
    dbError =
      e instanceof Error
        ? e.message
        : "Não foi possível carregar atendimentos. Rode a migration 0002.";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <ClipboardPlus className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Atendimento ASO
          </h1>
          <p className="text-sm text-muted-foreground">
            Leitura de PDF, cadastro clínico e exportação da Agenda Médica —
            usando o Alterdata já sincronizado neste sistema.
          </p>
        </div>
      </div>

      {dbError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {dbError}
        </div>
      ) : null}

      <ClinicAsoWorkspace
        physicians={physicians.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
        }))}
        attendances={attendances.map((r) => ({
          id: r.id,
          attendanceDate: r.attendanceDate,
          registration: r.registration,
          employeeName: r.employeeName,
          attendanceType: r.attendanceType,
          situation: r.situation,
          physicianName: r.physicianName,
          driveUrl: r.driveUrl,
          emailStatus: r.emailStatus,
          asoBlobUrl: r.asoBlobUrl,
        }))}
        integrations={clinicIntegrationsStatus()}
      />
    </div>
  );
}
