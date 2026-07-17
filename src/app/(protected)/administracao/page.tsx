import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { PageHeader } from "@/components/feedback/setup-banner";
import {
  countActiveUsers,
  countAuditLast24h,
  listAdminUsers,
  listAuditLogs,
  listRecentLoginAttempts,
} from "@/db/queries/admin";
import {
  ensureOrgDefaults,
  listRegions,
} from "@/db/queries/employees";
import { assignableRoles, ROLE_OPTIONS } from "@/lib/admin/roles";
import { requireSession, userCan } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";

export default async function AdministracaoPage() {
  const user = await requireSession();
  const canAdmin = can(user, "admin", "view");
  const canAudit = can(user, "audit", "view");
  const canSync = userCan(user, "imports", "sync_global");

  if (!canAdmin && !canAudit) {
    redirect("/dashboard");
  }

  if (canAdmin) {
    await ensureOrgDefaults(user.id);
  }

  const canCreateUsers = userCan(user, "admin", "create");
  const canManageUsers = userCan(user, "admin", "manage");
  const canManageOrg = userCan(user, "admin", "manage");

  const tabs = [
    ...(canCreateUsers || canAdmin ? (["access"] as const) : []),
    ...(canAudit ? (["audit"] as const) : []),
    ...(canSync || canAdmin ? (["import"] as const) : []),
    ...(canManageOrg ? (["org"] as const) : []),
  ];

  const roleOptions = ROLE_OPTIONS.filter((r) =>
    assignableRoles(user.role).includes(r.value),
  );

  const [
    usersList,
    auditLogs,
    loginAttempts,
    activeCount,
    audit24h,
    regions,
  ] = await Promise.all([
    canAdmin ? listAdminUsers() : Promise.resolve([]),
    canAudit ? listAuditLogs({ limit: 80 }) : Promise.resolve([]),
    canAudit ? listRecentLoginAttempts(40) : Promise.resolve([]),
    canAdmin ? countActiveUsers() : Promise.resolve(0),
    canAudit ? countAuditLast24h() : Promise.resolve(0),
    canManageOrg ? listRegions() : Promise.resolve([]),
  ]);

  const sheetConfigured = Boolean(
    process.env.ALTERDATA_MIRROR_SHEET_ID?.trim(),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Administração"
        description="Controle de acessos, auditoria e sincronização institucional."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="app-surface px-4 py-3.5">
          <p className="text-[11px] font-semibold tracking-[0.06em] text-slate-400 uppercase">
            Usuários ativos
          </p>
          <p className="mt-1 text-[22px] font-semibold tracking-tight tabular-nums text-slate-900">
            {canAdmin ? activeCount : "—"}
          </p>
        </div>
        <div className="app-surface px-4 py-3.5">
          <p className="text-[11px] font-semibold tracking-[0.06em] text-slate-400 uppercase">
            Eventos (24h)
          </p>
          <p className="mt-1 text-[22px] font-semibold tracking-tight tabular-nums text-slate-900">
            {canAudit ? audit24h : "—"}
          </p>
        </div>
        <div className="app-surface px-4 py-3.5">
          <p className="text-[11px] font-semibold tracking-[0.06em] text-slate-400 uppercase">
            Espelho Alterdata
          </p>
          <p className="mt-1 text-[15px] font-semibold tracking-tight text-slate-900">
            {sheetConfigured ? "Configurado" : "Não configurado"}
          </p>
        </div>
      </div>

      <AdminShell
        tabs={[...tabs]}
        users={usersList}
        roleOptions={roleOptions}
        canCreateUsers={canCreateUsers}
        canManageUsers={canManageUsers}
        currentUserId={user.id}
        auditLogs={auditLogs}
        loginAttempts={loginAttempts}
        canSync={canSync}
        sheetConfigured={sheetConfigured}
        canManageOrg={canManageOrg}
        regions={regions.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
        }))}
      />
    </div>
  );
}
