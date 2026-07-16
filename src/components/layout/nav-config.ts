import {
  Baby,
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileUp,
  HeartPulse,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  Stethoscope,
  Syringe,
  Users,
  FileText,
} from "lucide-react";
import type { ResourceModule } from "@/types";

export type NavItem = {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
  module: ResourceModule;
};

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, module: "dashboard" },
  { title: "Colaboradores", href: "/colaboradores", icon: Users, module: "employees" },
  { title: "ASOs", href: "/asos", icon: ClipboardList, module: "asos" },
  { title: "Agenda", href: "/agenda", icon: CalendarDays, module: "agenda" },
  { title: "Afastamentos", href: "/afastamentos", icon: HeartPulse, module: "leaves" },
  { title: "Vacinação", href: "/vacinacao", icon: Syringe, module: "vaccination" },
  { title: "Gestantes", href: "/gestantes", icon: Baby, module: "pregnancy" },
  {
    title: "Material Biológico",
    href: "/material-biologico",
    icon: ShieldAlert,
    module: "biological",
  },
  {
    title: "Atendimentos",
    href: "/atendimentos",
    icon: Stethoscope,
    module: "attendances",
  },
  { title: "Indicadores", href: "/indicadores", icon: BarChart3, module: "indicators" },
  { title: "Relatórios", href: "/relatorios", icon: FileText, module: "reports" },
  { title: "Importações", href: "/importacoes", icon: FileUp, module: "imports" },
  { title: "Administração", href: "/administracao", icon: Settings, module: "admin" },
];

export const APP_NAME = "EMSERH Saúde Ocupacional";
