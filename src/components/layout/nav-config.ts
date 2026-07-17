import {
  Baby,
  ClipboardList,
  HeartPulse,
  LayoutDashboard,
  Settings,
  ShieldAlert,
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

export type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "visao",
    label: "Visão geral",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        module: "dashboard",
      },
      {
        title: "Colaboradores",
        href: "/colaboradores",
        icon: Users,
        module: "employees",
      },
      {
        title: "Relatórios",
        href: "/relatorios",
        icon: FileText,
        module: "reports",
      },
    ],
  },
  {
    id: "operacional",
    label: "Operacional",
    items: [
      {
        title: "ASOs",
        href: "/asos",
        icon: ClipboardList,
        module: "asos",
      },
      {
        title: "Afastamentos",
        href: "/afastamentos",
        icon: HeartPulse,
        module: "leaves",
      },
      {
        title: "Vacinação",
        href: "/vacinacao",
        icon: Syringe,
        module: "vaccination",
      },
      {
        title: "Gestantes",
        href: "/gestantes",
        icon: Baby,
        module: "pregnancy",
      },
      {
        title: "Material Biológico",
        href: "/material-biologico",
        icon: ShieldAlert,
        module: "biological",
      },
    ],
  },
  {
    id: "admin",
    label: "Administração",
    items: [
      {
        title: "Administração",
        href: "/administracao",
        icon: Settings,
        module: "admin",
      },
    ],
  },
];

/** Flat list — useful for redirects / permission checks. */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export const APP_NAME = "EMSERH Saúde Ocupacional";
