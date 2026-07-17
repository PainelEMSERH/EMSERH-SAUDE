"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createUserAction,
  resetUserPasswordAction,
  setUserActiveAction,
  updateUserRoleAction,
  type AdminActionState,
} from "@/actions/admin-users";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { roleLabel } from "@/lib/admin/roles";
import { formatDateTimeBR } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { AdminUserRow } from "@/db/queries/admin";
import type { UserRole } from "@/types";

const initial: AdminActionState = {};

type RoleOption = { value: UserRole; label: string };

export function AdminUsersPanel({
  users,
  roleOptions,
  canCreate,
  canManage,
  currentUserId,
}: {
  users: AdminUserRow[];
  roleOptions: RoleOption[];
  canCreate: boolean;
  canManage: boolean;
  currentUserId: string;
}) {
  const [createState, createAction, createPending] = useActionState(
    createUserAction,
    initial,
  );
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (createState.ok && createState.message) setFlash(createState.message);
    if (createState.error) setFlash(null);
  }, [createState]);

  return (
    <div className="space-y-5">
      {canCreate ? (
        <section className="app-surface overflow-hidden">
          <div className="border-b border-border-subtle px-5 py-3.5">
            <h3 className="text-[14px] font-semibold text-slate-900">
              Novo usuário
            </h3>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Cria acesso ao sistema com perfil e senha inicial.
            </p>
          </div>
          <form action={createAction} className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="user-name" className="text-[12px]">
                Nome
              </Label>
              <Input id="user-name" name="name" required className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-email" className="text-[12px]">
                E-mail
              </Label>
              <Input
                id="user-email"
                name="email"
                type="email"
                required
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-password" className="text-[12px]">
                Senha inicial
              </Label>
              <Input
                id="user-password"
                name="password"
                type="password"
                required
                minLength={8}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-role" className="text-[12px]">
                Perfil
              </Label>
              <select
                id="user-role"
                name="role"
                required
                defaultValue="OPERADOR_UNIDADE"
                className="h-9 w-full rounded-lg border border-border bg-white px-2.5 text-[13px]"
              >
                {roleOptions.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-4">
              <Button
                type="submit"
                disabled={createPending}
                className="h-9 bg-primary hover:bg-primary-hover"
              >
                {createPending ? "Criando…" : "Criar usuário"}
              </Button>
            </div>
          </form>
          {createState.error ? (
            <p className="border-t border-border-subtle px-5 py-2.5 text-[13px] text-red-700">
              {createState.error}
            </p>
          ) : null}
          {flash ? (
            <p className="border-t border-border-subtle px-5 py-2.5 text-[13px] text-emerald-800">
              {flash}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="app-surface overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-3.5">
          <div>
            <h3 className="text-[14px] font-semibold text-slate-900">
              Usuários do sistema
            </h3>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {users.length} conta{users.length === 1 ? "" : "s"} · controle de
              perfil e status
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="app-data-table">
            <thead>
              <tr>
                <th className="text-left">Usuário</th>
                <th className="text-left">Perfil</th>
                <th className="text-center">Status</th>
                <th className="text-center">Último acesso</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="min-w-0">
                        <p className="app-table-emphasis truncate">{u.name}</p>
                        <p className="app-table-meta truncate">{u.email}</p>
                      </div>
                    </td>
                    <td>
                      {canCreate && !isSelf ? (
                        <RoleForm
                          userId={u.id}
                          role={u.role}
                          roleOptions={roleOptions}
                        />
                      ) : (
                        <span className="text-[12px] font-medium text-slate-700">
                          {roleLabel(u.role)}
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      <StatusBadge
                        label={u.isActive ? "Ativo" : "Inativo"}
                        tone={u.isActive ? "ok" : "muted"}
                      />
                    </td>
                    <td className="text-center tabular-nums text-slate-500">
                      {u.lastLoginAt
                        ? formatDateTimeBR(u.lastLoginAt)
                        : "—"}
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {canManage && !isSelf ? (
                          <>
                            <ActiveForm userId={u.id} isActive={u.isActive} />
                            <PasswordForm userId={u.id} />
                          </>
                        ) : isSelf ? (
                          <span className="text-[11px] text-slate-400">
                            Você
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RoleForm({
  userId,
  role,
  roleOptions,
}: {
  userId: string;
  role: string;
  roleOptions: RoleOption[];
}) {
  const [state, action, pending] = useActionState(
    updateUserRoleAction,
    initial,
  );

  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={role}
        disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={cn(
          "h-8 max-w-[180px] rounded-md border border-border bg-white px-2 text-[11.5px]",
          pending && "opacity-60",
        )}
        title={state.error ?? undefined}
      >
        {roleOptions.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
    </form>
  );
}

function ActiveForm({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const [, action, pending] = useActionState(setUserActiveAction, initial);
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <input
        type="hidden"
        name="active"
        value={isActive ? "false" : "true"}
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending}
        className="h-7 px-2 text-[11px]"
      >
        {isActive ? "Desativar" : "Reativar"}
      </Button>
    </form>
  );
}

function PasswordForm({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    resetUserPasswordAction,
    initial,
  );

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 px-2 text-[11px]"
        onClick={() => setOpen(true)}
      >
        Senha
      </Button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="userId" value={userId} />
      <Input
        name="password"
        type="password"
        required
        minLength={8}
        placeholder="Nova senha"
        className="h-7 w-[120px] text-[11px]"
      />
      <Button
        type="submit"
        size="sm"
        disabled={pending}
        className="h-7 bg-primary px-2 text-[11px] hover:bg-primary-hover"
      >
        OK
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 px-1.5 text-[11px]"
        onClick={() => setOpen(false)}
      >
        ×
      </Button>
    </form>
  );
}
