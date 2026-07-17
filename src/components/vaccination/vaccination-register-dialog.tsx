"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createVaccinationAction } from "@/actions/occupational";
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
  VACCINE_DEFS,
  VACCINE_SITUATIONS,
  type VaccineCode,
} from "@/lib/vaccination/constants";

type State = { error?: string; ok?: boolean };
const initial: State = {};

export function VaccinationRegisterDialog({
  defaultVaccine,
}: {
  defaultVaccine?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [vaccine, setVaccine] = useState<VaccineCode>(
    (defaultVaccine as VaccineCode) || "TETANO",
  );
  const [state, formAction, pending] = useActionState(
    createVaccinationAction,
    initial,
  );

  const situations = useMemo(
    () => VACCINE_SITUATIONS[vaccine] ?? [],
    [vaccine],
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
          <Button size="sm" className="h-8 bg-teal-800 text-[13px] hover:bg-teal-900">
            Registrar situação
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar situação vacinal</DialogTitle>
          <DialogDescription>
            Use as mesmas opções da planilha. A situação muda conforme a vacina
            escolhida.
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
              <Label htmlFor="vaccineCode">Vacina *</Label>
              <select
                id="vaccineCode"
                name="vaccineCode"
                required
                value={vaccine}
                onChange={(e) => setVaccine(e.target.value as VaccineCode)}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-[13px] outline-none focus-visible:border-teal-600"
              >
                {VACCINE_DEFS.map((v) => (
                  <option key={v.code} value={v.code}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="administeredAt">Data</Label>
              <Input
                id="administeredAt"
                name="administeredAt"
                type="date"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="situation">Situação *</Label>
              <select
                id="situation"
                name="situation"
                required
                key={vaccine}
                defaultValue={situations[0]}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-[13px] outline-none focus-visible:border-teal-600"
              >
                {situations.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="lotNumber">Lote</Label>
              <Input id="lotNumber" name="lotNumber" className="h-9" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Observação</Label>
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
