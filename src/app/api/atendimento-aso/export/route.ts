import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { listClinicAttendances } from "@/db/queries/clinic-aso";
import {
  recordToAgendaMedicaRow,
  recordsToAgendaWorkbook,
} from "@/lib/clinic-aso/agenda-export";

export async function GET() {
  try {
    await requirePermission("attendances", "export");
  } catch {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const rows = await listClinicAttendances(5000);
  const exportRows = rows.map((r) =>
    recordToAgendaMedicaRow({
      attendanceDate: r.attendanceDate,
      registration: r.registration,
      employeeName: r.employeeName,
      department: r.department,
      jobTitle: r.jobTitle,
      cpf: r.cpf,
      sus: r.sus,
      attendanceType: r.attendanceType,
      situation: r.situation,
      conduct: r.conduct,
      physicianCode: r.physicianCode,
      physicianName: r.physicianName,
      notes: r.notes,
      physicalActivity: r.physicalActivity,
      lifestyle: r.lifestyle,
      sex: r.sex,
      weight: r.weight,
      height: r.height,
      bmi: r.bmi,
      bmiResult: r.bmiResult,
      profile: r.profile,
      city: r.city,
      birthDate: r.birthDate,
      age: r.age,
    }),
  );

  const buf = recordsToAgendaWorkbook(exportRows);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="agenda-medica-2026.xlsx"`,
    },
  });
}
