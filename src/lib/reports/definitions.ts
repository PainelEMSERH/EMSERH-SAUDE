import type { LucideIcon } from "lucide-react";
import {
  Baby,
  ClipboardList,
  HeartPulse,
  ShieldAlert,
  Syringe,
  Users,
} from "lucide-react";

export type ReportType =
  | "employees"
  | "asos"
  | "leaves"
  | "vaccinations"
  | "pregnancies"
  | "biological";

export type ReportDefinition = {
  key: ReportType;
  title: string;
  description: string;
  detail: string;
  sheetName: string;
  filename: string;
  icon: LucideIcon;
};

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    key: "employees",
    title: "Colaboradores",
    description: "Cadastro completo no escopo do usuário.",
    detail:
      "Matrícula, nome, situação, unidade, regional, cargo, admissão e demissão.",
    sheetName: "Colaboradores",
    filename: "emserh-colaboradores.xlsx",
    icon: Users,
  },
  {
    key: "asos",
    title: "ASOs",
    description: "Histórico de ASOs realizados e previstos.",
    detail:
      "Tipo, datas, resultado, prazo, unidade/regional e vínculo com o colaborador.",
    sheetName: "ASOs",
    filename: "emserh-asos.xlsx",
    icon: ClipboardList,
  },
  {
    key: "leaves",
    title: "Afastamentos",
    description: "Atestados, INSS, licenças e retornos.",
    detail: "Tipo, período, dias, status, retorno ASO e observação resumida.",
    sheetName: "Afastamentos",
    filename: "emserh-afastamentos.xlsx",
    icon: HeartPulse,
  },
  {
    key: "vaccinations",
    title: "Vacinação",
    description: "Situação vacinal por imunizante.",
    detail: "Vacina, dose, data, status e unidade do colaborador.",
    sheetName: "Vacinacao",
    filename: "emserh-vacinacao.xlsx",
    icon: Syringe,
  },
  {
    key: "pregnancies",
    title: "Gestantes",
    description: "Comunicação, insalubridade e realocação.",
    detail:
      "Status, comprovação, setores, datas de realocação/licença e alerta operacional.",
    sheetName: "Gestantes",
    filename: "emserh-gestantes.xlsx",
    icon: Baby,
  },
  {
    key: "biological",
    title: "Material biológico",
    description: "Exposições, PEP, CAT e follow-ups.",
    detail: "Ocorrência, PEP, CAT, status e datas D30/D60/D90 quando houver.",
    sheetName: "Material_biologico",
    filename: "emserh-material-biologico.xlsx",
    icon: ShieldAlert,
  },
];

export function getReportDefinition(key: string): ReportDefinition | undefined {
  return REPORT_DEFINITIONS.find((r) => r.key === key);
}
