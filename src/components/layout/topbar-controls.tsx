"use client";

import { PanelLeft, PanelLeftClose } from "lucide-react";
import { useSidebarUi } from "@/components/layout/sidebar-ui";
import { cn } from "@/lib/utils";

export function ConnectionStatus({
  online = true,
}: {
  online?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-[12px] font-medium",
        online ? "text-muted-foreground" : "text-muted-foreground/70",
      )}
      title={online ? "Sessão ativa" : "Sem conexão"}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          online ? "bg-primary/80" : "bg-muted-foreground/50",
        )}
        aria-hidden
      />
      <span>{online ? "Conectado" : "Offline"}</span>
    </div>
  );
}

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
      className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted"
    >
      <Icon className="size-4" strokeWidth={1.75} />
    </button>
  );
}
