"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions";
import type { SessionUser } from "@/types";
import { APP_NAME, NAV_ITEMS } from "./nav-config";

function NavLinks({
  user,
  onNavigate,
}: {
  user: SessionUser;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.filter((item) => can(user, item.module, "view")).map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-teal-700 text-white"
                : "text-slate-600 hover:bg-teal-50 hover:text-teal-900",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppSidebar({ user }: { user: SessionUser }) {
  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="border-b border-slate-200 px-4 py-5">
        <p className="text-xs font-semibold tracking-[0.18em] text-teal-700 uppercase">
          EMSERH
        </p>
        <h1 className="mt-1 text-sm leading-snug font-semibold text-slate-900">
          {APP_NAME}
        </h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavLinks user={user} />
      </div>
      <div className="border-t border-slate-200 p-4">
        <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
        <p className="truncate text-xs text-slate-500">{user.email}</p>
        <p className="mt-1 text-[11px] tracking-wide text-teal-700 uppercase">
          {user.role.replaceAll("_", " ")}
        </p>
        <form action={logoutAction} className="mt-3">
          <Button type="submit" variant="outline" size="sm" className="w-full">
            <LogOut className="size-4" />
            Sair
          </Button>
        </form>
      </div>
    </aside>
  );
}

export function MobileNav({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="outline" size="icon-sm" aria-label="Abrir menu" />
          }
        >
          <Menu className="size-4" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <div className="border-b px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.18em] text-teal-700 uppercase">
              EMSERH
            </p>
            <p className="text-sm font-semibold">{APP_NAME}</p>
          </div>
          <NavLinks user={user} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div>
        <p className="text-sm font-semibold text-slate-900">Saúde Ocupacional</p>
        <p className="text-xs text-slate-500">{user.name}</p>
      </div>
    </div>
  );
}
