"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { logoutAction } from "@/actions/auth";
import { useSidebarUi } from "@/components/layout/sidebar-ui";
import {
  SidebarCollapseButton,
} from "@/components/layout/topbar-controls";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { initialsFromName } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions";
import type { SessionUser } from "@/types";
import { APP_NAME, NAV_SECTIONS } from "./nav-config";

function NavLinks({
  user,
  onNavigate,
  collapsed = false,
}: {
  user: SessionUser;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex flex-col gap-[13px] py-3",
        collapsed ? "px-2" : "px-2.5",
      )}
    >
      {NAV_SECTIONS.map((section) => {
        const items = section.items.filter((item) =>
          can(user, item.module, "view"),
        );
        if (!items.length) return null;

        return (
          <div key={section.id}>
            {!collapsed ? (
              <p className="mb-1.5 px-[10px] text-[10px] font-semibold tracking-[0.1em] text-slate-400 uppercase">
                {section.label}
              </p>
            ) : (
              <div
                className="mx-auto mb-1 h-px w-5 bg-sidebar-border"
                aria-hidden
              />
            )}
            <div className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.title : undefined}
                    className={cn(
                      "flex h-[34px] items-center rounded-lg text-[12.5px] leading-none transition-colors",
                      collapsed
                        ? "justify-center px-0"
                        : "gap-2 px-[10px] py-[6px]",
                      active
                        ? "border border-primary-border bg-primary-soft font-medium text-primary shadow-[inset_0_0_0_1px_rgba(167,243,208,0.35)]"
                        : "border border-transparent text-sidebar-foreground hover:bg-white hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-[14px] shrink-0",
                        active ? "text-primary" : "text-sidebar-foreground",
                      )}
                      strokeWidth={1.75}
                    />
                    {!collapsed ? (
                      <span className="truncate">{item.title}</span>
                    ) : (
                      <span className="sr-only">{item.title}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function UserMenu({ user }: { user: SessionUser }) {
  const initials = initialsFromName(user.name);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-primary text-[11px] font-semibold tracking-wide text-primary-foreground outline-none transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label="Conta"
      >
        {initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1.5">
        <div className="px-2 py-1.5">
          <p className="truncate text-[13px] font-medium text-foreground">
            {user.name}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {user.email}
          </p>
          <p className="mt-1 text-[10px] font-semibold tracking-wide text-primary uppercase">
            {user.role.replaceAll("_", " ")}
          </p>
        </div>
        <div className="my-1 h-px bg-border" />
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="size-3.5" />
            Sair
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppSidebar({ user }: { user: SessionUser }) {
  const { collapsed } = useSidebarUi();

  return (
    <aside
      className={cn(
        "hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
        collapsed ? "w-[64px]" : "w-[236px]",
      )}
    >
      <div className={cn("border-b border-sidebar-border pb-3 pt-5", collapsed ? "px-2" : "px-3.5")}>
        {collapsed ? (
          <p
            className="text-center text-[12px] font-bold tracking-tight text-primary"
            title={APP_NAME}
          >
            ES
          </p>
        ) : (
          <>
            <p className="text-[15px] font-semibold tracking-tight text-foreground">
              Menu
            </p>
            <p className="mt-1 truncate text-[10px] font-semibold tracking-[0.14em] text-primary uppercase">
              EMSERH · Saúde
            </p>
          </>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <NavLinks user={user} collapsed={collapsed} />
      </div>
    </aside>
  );
}

export function AppTopbar({ user }: { user: SessionUser }) {
  return (
    <header className="hidden h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-5 lg:flex">
      <div className="flex items-center gap-3">
        <SidebarCollapseButton />
      </div>
      <div className="flex items-center gap-2.5">
        <UserMenu user={user} />
      </div>
    </header>
  );
}

export function MobileNav({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2.5 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="outline" size="icon-sm" aria-label="Abrir menu" />
          }
        >
          <Menu className="size-4" />
        </SheetTrigger>
        <SheetContent side="left" className="w-[236px] bg-sidebar p-0">
          <div className="border-b border-sidebar-border px-3.5 pt-5 pb-3">
            <p className="text-[15px] font-semibold tracking-tight text-foreground">
              Menu
            </p>
            <p className="mt-1 text-[10px] font-semibold tracking-[0.14em] text-primary uppercase">
              {APP_NAME}
            </p>
          </div>
          <NavLinks user={user} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">
          Saúde Ocupacional
        </p>
      </div>
      <UserMenu user={user} />
    </div>
  );
}
