"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPregnancyAction } from "@/actions/occupational";
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
import {
  PREGNANCY_PROOF_TYPES,
  PREGNANCY_STATUSES,
} from "@/lib/pregnancy/constants";

type State = { error?: string; ok?: boolean };
const initial: State = {};

export function PregnancyRegisterDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createPregnancyAction,
    initial,
  );

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
          <Button
            size="sm"
            className="h-8 bg-primary text-[13px] hover:bg-primary-hover"
          >
            Registrar caso
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar gestante</DialogTitle>
          <DialogDescription>
            Comunicação da gestação, insalubridade e realocação de setor.
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
              <Label htmlFor="communicationDate">Data da comunicação</Label>
              <Input
                id="communicationDate"
                name="communicationDate"
                type="date"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Previsão de parto</Label>
              <Input id="dueDate" name="dueDate" type="date" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proofType">Tipo de comprovação</Label>
              <select
                id="proofType"
                name="proofType"
                defaultValue=""
                className="h-9 w-full rounded-md border border-border bg-card px-2.5 text-[13px] outline-none focus-visible:border-primary"
              >
                <option value="">—</option>
                {PREGNANCY_PROOF_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue="EM_ACOMPANHAMENTO"
                className="h-9 w-full rounded-md border border-border bg-card px-2.5 text-[13px] outline-none focus-visible:border-primary"
              >
                {PREGNANCY_STATUSES.filter((s) => s.value !== "ALL").map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hazardousActivity">Atividade insalubre?</Label>
              <select
                id="hazardousActivity"
                name="hazardousActivity"
                defaultValue="false"
                className="h-9 w-full rounded-md border border-border bg-card px-2.5 text-[13px] outline-none focus-visible:border-primary"
              >
                <option value="false">Não</option>
                <option value="true">Sim</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="relocationDate">Data da realocação</Label>
              <Input
                id="relocationDate"
                name="relocationDate"
                type="date"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="originSector">Setor origem</Label>
              <Input id="originSector" name="originSector" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="destinationSector">Setor destino</Label>
              <Input
                id="destinationSector"
                name="destinationSector"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={2}
                className="resize-none text-[13px]"
              />
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
