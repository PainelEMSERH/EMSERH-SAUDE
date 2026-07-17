"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createLeaveAction } from "@/actions/occupational";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LEAVE_STATUSES, LEAVE_TYPES } from "@/lib/leaves/constants";

type State = { error?: string; ok?: boolean };
const initial: State = {};

export function LeavesRegisterDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createLeaveAction, initial);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="h-8 bg-primary text-[13px] hover:bg-primary-hover">
            Registrar afastamento
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar afastamento</DialogTitle>
          <DialogDescription>
            Informe a matrícula e o período. Tipos INSS e acidente marcam retorno
            com ASO automaticamente.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="registration">Matrícula *</Label>
              <Input
                id="registration"
                name="registration"
                required
                className="h-9"
                placeholder="Ex.: 015166"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="leaveType">Tipo *</Label>
              <select
                id="leaveType"
                name="leaveType"
                required
                defaultValue="01 - Afast. por motivo de doen"
                className="h-9 w-full rounded-md border border-border bg-card px-2.5 text-[13px] outline-none focus-visible:border-primary"
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue="ATIVO"
                className="h-9 w-full rounded-md border border-border bg-card px-2.5 text-[13px] outline-none focus-visible:border-primary"
              >
                {LEAVE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Início *</Label>
              <Input id="startDate" name="startDate" type="date" required className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">Fim</Label>
              <Input id="endDate" name="endDate" type="date" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cidCode">CID</Label>
              <Input id="cidCode" name="cidCode" className="h-9" placeholder="Opcional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reasonSimplified">Motivo resumido</Label>
              <Input
                id="reasonSimplified"
                name="reasonSimplified"
                className="h-9"
                placeholder="Ex.: Cirurgia, INSS…"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="reason">Motivo / observação</Label>
              <Textarea id="reason" name="reason" rows={2} className="resize-none text-[13px]" />
            </div>
          </div>
          {state.error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-800">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={pending}
              className="bg-primary hover:bg-primary-hover"
            >
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
