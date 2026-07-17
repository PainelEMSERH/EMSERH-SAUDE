"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBiologicalAccidentAction } from "@/actions/occupational";
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

type State = { error?: string; ok?: boolean };
const initial: State = {};

export function BiologicalRegisterDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createBiologicalAccidentAction,
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
            className="h-8 bg-teal-800 text-[13px] hover:bg-teal-900"
          >
            Registrar acidente
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar exposição biológica</DialogTitle>
          <DialogDescription>
            Gera automaticamente os acompanhamentos D30, D60 e D90.
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
              <Label htmlFor="occurredAt">Data/hora *</Label>
              <Input
                id="occurredAt"
                name="occurredAt"
                type="datetime-local"
                required
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pepStarted">PEP iniciado?</Label>
              <select
                id="pepStarted"
                name="pepStarted"
                defaultValue="false"
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-[13px] outline-none focus-visible:border-teal-600"
              >
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="exposureType">Local / tipo da lesão</Label>
              <Input
                id="exposureType"
                name="exposureType"
                className="h-9"
                placeholder="Ex.: 4º quirodáctilo mão esquerda"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bodyPart">Parte do corpo</Label>
              <Input id="bodyPart" name="bodyPart" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="catNumber">Nº CAT</Label>
              <Input id="catNumber" name="catNumber" className="h-9" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="description">Descrição da ocorrência</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
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
              className="bg-teal-800 hover:bg-teal-900"
            >
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
