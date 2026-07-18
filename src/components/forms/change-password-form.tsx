"use client";

import { useActionState } from "react";
import { changePasswordAction, type LoginState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: LoginState = {};

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initial);

  return (
    <form action={action} className="mx-auto max-w-md space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">Senha atual</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          className="h-9"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">Nova senha</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="h-9"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="h-9"
        />
      </div>
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {state.error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={pending}
        className="h-9 w-full bg-primary hover:bg-primary-hover"
      >
        {pending ? "Salvando…" : "Alterar senha e continuar"}
      </Button>
    </form>
  );
}
