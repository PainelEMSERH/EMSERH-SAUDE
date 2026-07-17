"use client";

import { PanelLeft, PanelLeftClose } from "lucide-react";
import { useSidebarUi } from "@/components/layout/sidebar-ui";

export function SidebarCollapseButton() {
  const { collapsed, toggle } = useSidebarUi();
  const Icon = collapsed ? PanelLeft : PanelLeftClose;

  return (
    <button
      type="button"
      onClick={toggle}
      title={collapsed ? "Expandir menu" : "Recolher menu"}
      aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
      aria-pressed={collapsed}
      className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted"
    >
      <Icon className="size-4" strokeWidth={1.75} />
    </button>
  );
}
