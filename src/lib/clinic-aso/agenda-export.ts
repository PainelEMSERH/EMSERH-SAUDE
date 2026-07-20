import * as XLSX from "xlsx";
import {
  AGENDA_MEDICA_COLUMNS,
  type AgendaMedicaRow,
} from "@/lib/clinic-aso/types";

export function recordToAgendaMedicaRow(r: {
  attendanceDate: string;
  registration: string;
  employeeName: string;
  department: string;
  jobTitle: string;
  cpf: string;
  sus: string;
  attendanceType: string;
  situation: string;
  conduct: string;
  physicianCode: string;
  physicianName: string;
  notes: string;
  physicalActivity: string;
  lifestyle: string;
  sex: string;
  weight: string | null;
  height: string | null;
  bmi: string | null;
  bmiResult: string;
  profile: string;
  city: string;
  birthDate: string | null;
  age: number | null;
}): AgendaMedicaRow {
  return {
    Data: r.attendanceDate,
    Matrícula: r.registration,
    "Nome do Funcionário": r.employeeName,
    Departamento: r.department,
    Função: r.jobTitle,
    CPF: r.cpf,
    SUS: r.sus,
    Atendimento: r.attendanceType,
    Situação: r.situation,
    Conduta: r.conduct,
    "Cód Médico": r.physicianCode,
    Médico: r.physicianName,
    OBS: r.notes,
    "Prática atividades físicas": r.physicalActivity,
    "Hábitos de Vida": r.lifestyle,
    Sexo: r.sex,
    Peso: r.weight,
    Altura: r.height,
    IMC_: r.bmi,
    "Resultado IMC": r.bmiResult,
    Perfil: r.profile,
    Cidade: r.city,
    "Data Nasc": r.birthDate,
    Idade: r.age,
  };
}

export function recordsToAgendaWorkbook(rows: AgendaMedicaRow[]): Buffer {
  const ordered = rows.map((row) => {
    const out: Record<string, string | number | null> = {};
    for (const col of AGENDA_MEDICA_COLUMNS) {
      out[col] = row[col] ?? null;
    }
    return out;
  });
  const ws = XLSX.utils.json_to_sheet(ordered, {
    header: [...AGENDA_MEDICA_COLUMNS],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "AGENDA MÉDICA 2026");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
