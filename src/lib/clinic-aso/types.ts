export const CLINIC_ATTENDANCE_TYPES = [
  "Admissional",
  "Demissional",
  "Retorno ao Trabalho",
  "Mudança de Função",
  "Periódico",
  "Consulta",
] as const;

export type ClinicAttendanceType = (typeof CLINIC_ATTENDANCE_TYPES)[number];

export const CLINIC_SITUATIONS = ["Apto", "Inapto", "Realizada"] as const;
export type ClinicSituation = (typeof CLINIC_SITUATIONS)[number];

export const CLINIC_YES_NO = ["Sim", "Não"] as const;
export type ClinicYesNo = (typeof CLINIC_YES_NO)[number];

export const CLINIC_LIFESTYLE = [
  "Bebe",
  "Fuma",
  "Fuma e Bebe",
  "Nem Bebe e Nem Fuma",
] as const;
export type ClinicLifestyle = (typeof CLINIC_LIFESTYLE)[number];

export const CLINIC_SEX = ["Masculino", "Feminino"] as const;
export type ClinicSex = (typeof CLINIC_SEX)[number];

export const ADMISSIONAL_REGISTRATION = "00000";

export type ClinicAsoFormFields = {
  date: string | null;
  matricula: string | null;
  employeeName: string | null;
  department: string | null;
  jobTitle: string | null;
  cpf: string | null;
  sus: string | null;
  attendanceType: ClinicAttendanceType | null;
  situation: ClinicSituation | null;
  conduct: string | null;
  physicianCode: string | null;
  physicianName: string | null;
  notes: string | null;
  physicalActivity: ClinicYesNo | null;
  lifestyle: ClinicLifestyle | null;
  sex: ClinicSex | null;
  weight: string | null;
  height: string | null;
  profile: string | null;
  city: string | null;
  birthDate: string | null;
};

export const EMPTY_CLINIC_ASO_FIELDS: ClinicAsoFormFields = {
  date: null,
  matricula: null,
  employeeName: null,
  department: null,
  jobTitle: null,
  cpf: null,
  sus: null,
  attendanceType: null,
  situation: null,
  conduct: null,
  physicianCode: null,
  physicianName: null,
  notes: null,
  physicalActivity: null,
  lifestyle: null,
  sex: null,
  weight: null,
  height: null,
  profile: null,
  city: null,
  birthDate: null,
};

export const AGENDA_MEDICA_COLUMNS = [
  "Data",
  "Matrícula",
  "Nome do Funcionário",
  "Departamento",
  "Função",
  "CPF",
  "SUS",
  "Atendimento",
  "Situação",
  "Conduta",
  "Cód Médico",
  "Médico",
  "OBS",
  "Prática atividades físicas",
  "Hábitos de Vida",
  "Sexo",
  "Peso",
  "Altura",
  "IMC_",
  "Resultado IMC",
  "Perfil",
  "Cidade",
  "Data Nasc",
  "Idade",
] as const;

export type AgendaMedicaColumn = (typeof AGENDA_MEDICA_COLUMNS)[number];
export type AgendaMedicaRow = Record<
  AgendaMedicaColumn,
  string | number | null
>;
