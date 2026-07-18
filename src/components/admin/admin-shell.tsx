"use client";

import { useState } from "react";
import {
  Building2,
  ClipboardCheck,
  KeyRound,
  RefreshCw,
  ScrollText,
} from "lucide-react";
import { AdminAsoOpsPanel } from "@/components/admin/aso-ops-panel";
import { AdminAuditPanel } from "@/components/admin/audit-panel";
import { AdminUsersPanel } from "@/components/admin/users-panel";
import type { LastSyncInfo } from "@/components/aso/aso-panel-header";
import { MirrorSyncForm } from "@/components/forms/mirror-sync-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertRegionAction, upsertUnitAction } from "@/actions/employees";
import { cn } from "@/lib/utils";
import type { AdminUserRow, AuditLogRow, LoginAttemptRow } from "@/db/queries/admin";
import type { UserRole } from "@/types";

type TabId = "access" | "audit" | "import" | "org";

type RoleOption = { value: UserRole; label: string };
type RegionOption = { id: string; code: string; name: string };
type UnitOption = {
  id: string;
  name: string;
  regionId: string | null;
  regionCode: string | null;
};

export function AdminShell({
  tabs,
  users,
  roleOptions,
  canCreateUsers,
  canManageUsers,
  currentUserId,
  auditLogs,
  loginAttempts,
  canSync,
  sheetConfigured,
  canManageOrg,
  regions,
  units,
  asoLastSync,
  asoYear,
  canManageAsoPlanning,
  canExportAso,
}: {
  tabs: TabId[];
  users: AdminUserRow[];
  roleOptions: RoleOption[];
  canCreateUsers: boolean;
  canManageUsers: boolean;
  currentUserId: string;
  auditLogs: AuditLogRow[];
  loginAttempts: LoginAttemptRow[];
  canSync: boolean;
  sheetConfigured: boolean;
  canManageOrg: boolean;
  regions: RegionOption[];
  units: UnitOption[];
  asoLastSync: LastSyncInfo;
  asoYear: number;
  canManageAsoPlanning: boolean;
  canExportAso: boolean;
}) {
  const [tab, setTab] = useState<TabId>(tabs[0] ?? "access");

  const items: {
    id: TabId;
    label: string;
    icon: typeof KeyRound;
  }[] = (
    [
      { id: "access" as const, label: "Acessos", icon: KeyRound },
      { id: "audit" as const, label: "Auditoria", icon: ScrollText },
      { id: "import" as const, label: "Importação", icon: RefreshCw },
      { id: "org" as const, label: "Organização", icon: Building2 },
    ] as const
  ).filter((i) => tabs.includes(i.id));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-white p-1 shadow-[var(--shadow-card)]">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-medium transition-colors",
              tab === id
                ? "bg-emerald-50 text-emerald-800"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
            )}
          >
            <Icon className="size-3.5" strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      {tab === "access" ? (
        <AdminUsersPanel
          users={users}
          roleOptions={roleOptions}
          regions={regions}
          units={units}
          canCreate={canCreateUsers}
          canManage={canManageUsers}
          currentUserId={currentUserId}
        />
      ) : null}

      {tab === "audit" ? (
        <AdminAuditPanel logs={auditLogs} loginAttempts={loginAttempts} />
      ) : null}

      {tab === "import" ? (
        <div className="space-y-4">
          <section className="app-surface overflow-hidden">
            <div className="flex items-start gap-3 border-b border-border-subtle px-5 py-4">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
                <RefreshCw className="size-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">
                  Espelho Alterdata
                </h3>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">
                  Sincronização global dos cadastros (somente leitura).
                </p>
              </div>
            </div>
            <div className="px-5 py-4">
              {canSync ? (
                <MirrorSyncForm sheetConfigured={sheetConfigured} />
              ) : (
                <p className="text-[13px] text-slate-500">
                  Seu perfil não executa sincronização global.
                </p>
              )}
            </div>
          </section>

          <section className="app-surface overflow-hidden">
            <div className="flex items-start gap-3 border-b border-border-subtle px-5 py-4">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
                <ClipboardCheck className="size-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">
                  Operações de ASO
                </h3>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">
                  Sincronizar espelho de ASO, gerar planejamento e exportar.
                  Cadastro manual não é usado — dados vêm do Alterdata.
                </p>
              </div>
            </div>
            <div className="px-5 py-4">
              <AdminAsoOpsPanel
                lastSync={asoLastSync}
                year={asoYear}
                canSync={canSync}
                canManagePlanning={canManageAsoPlanning}
                canExport={canExportAso}
              />
            </div>
          </section>
        </div>
      ) : null}

      {tab === "org" && canManageOrg ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="app-surface overflow-hidden">
            <div className="border-b border-border-subtle px-5 py-3.5">
              <h3 className="text-[14px] font-semibold text-slate-900">
                Nova regional
              </h3>
            </div>
            <form action={upsertRegionAction} className="space-y-3.5 px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="code" className="text-[12px]">
                    Código
                  </Label>
                  <Input id="code" name="code" placeholder="NORTE" required className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-[12px]">
                    Nome
                  </Label>
                  <Input id="name" name="name" placeholder="Norte" required className="h-9" />
                </div>
              </div>
              <Button type="submit" className="h-9 bg-primary hover:bg-primary-hover">
                Salvar regional
              </Button>
            </form>
            <ul className="divide-y divide-border-subtle border-t border-border-subtle">
              {regions.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]"
                >
                  <span className="font-medium text-slate-800">{r.name}</span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                    {r.code}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="app-surface overflow-hidden">
            <div className="border-b border-border-subtle px-5 py-3.5">
              <h3 className="text-[14px] font-semibold text-slate-900">
                Nova unidade
              </h3>
            </div>
            <form action={upsertUnitAction} className="space-y-3.5 px-5 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="regionId" className="text-[12px]">
                  Regional
                </Label>
                <select
                  id="regionId"
                  name="regionId"
                  required
                  className="h-9 w-full rounded-lg border border-border bg-white px-2.5 text-[13px]"
                >
                  <option value="">Selecionar…</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unitName" className="text-[12px]">
                  Nome
                </Label>
                <Input id="unitName" name="name" required className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city" className="text-[12px]">
                  Cidade
                </Label>
                <Input id="city" name="city" className="h-9" />
              </div>
              <Button type="submit" className="h-9 bg-primary hover:bg-primary-hover">
                Salvar unidade
              </Button>
            </form>
          </div>
        </section>
      ) : null}
    </div>
  );
}
