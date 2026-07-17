"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { logoutAction } from "@/actions/auth";
import { ThemeToggle } from "@/components/layout/theme-toggle";
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
}: {
  user: SessionUser;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5 px-3 py-3">
      {NAV_SECTIONS.map((section) => {
        const items = section.items.filter((item) =>
          can(user, item.module, "view"),
        );
        if (!items.length) return null;

        return (
          <div key={section.id}>
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold tracking-[0.08em] text-slate-400 uppercase">
              {section.label}
            </p>
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
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors",
                      active
                        ? "border border-slate-300 bg-white font-medium text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        : "border border-transparent text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        active
                          ? "text-slate-800 dark:text-slate-100"
                          : "text-slate-500",
                      )}
                      strokeWidth={1.75}
                    />
                    <span className="truncate">{item.title}</span>
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
        className="inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-teal-800 text-[11px] font-semibold tracking-wide text-white outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-teal-600/40 dark:border-slate-700"
        aria-label="Conta"
      >
        {initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1.5">
        <div className="px-2 py-1.5">
          <p className="truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
            {user.name}
          </p>
          <p className="truncate text-[11px] text-slate-500">{user.email}</p>
          <p className="mt-1 text-[10px] font-semibold tracking-wide text-teal-700 uppercase dark:text-teal-400">
            {user.role.replaceAll("_", " ")}
          </p>
        </div>
        <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-red-700 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
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
  return (
    <aside className="hidden h-svh w-[220px] shrink-0 flex-col border-r border-slate-200/90 bg-[#f7f8fa] dark:border-slate-800 dark:bg-slate-950 lg:flex">
      <div className="px-4 pt-5 pb-2">
        <p className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Menu
        </p>
        <p className="mt-0.5 truncate text-[10px] font-medium tracking-[0.12em] text-teal-700 uppercase dark:text-teal-400">
          EMSERH · Saúde
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <NavLinks user={user} />
      </div>
    </aside>
  );
}

export function AppTopbar({ user }: { user: SessionUser }) {
  return (
    <header className="hidden h-12 shrink-0 items-center justify-end gap-2.5 border-b border-slate-200/80 bg-slate-50/80 px-4 dark:border-slate-800 dark:bg-slate-950/50 md:px-5 lg:flex">
      <ThemeToggle />
      <UserMenu user={user} />
    </header>
  );
}

export function MobileNav({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 lg:hidden dark:border-slate-800 dark:bg-slate-950">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="outline" size="icon-sm" aria-label="Abrir menu" />
          }
        >
          <Menu className="size-4" />
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-[240px] bg-[#f7f8fa] p-0 dark:bg-slate-950"
        >
          <div className="px-4 pt-5 pb-2">
            <p className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Menu
            </p>
            <p className="mt-0.5 text-[10px] font-medium tracking-[0.12em] text-teal-700 uppercase">
              {APP_NAME}
            </p>
          </div>
          <NavLinks user={user} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
          Saúde Ocupacional
        </p>
      </div>
      <ThemeToggle />
      <UserMenu user={user} />
    </div>
  );
}
