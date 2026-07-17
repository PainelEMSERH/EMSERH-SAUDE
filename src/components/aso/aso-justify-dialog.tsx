"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { justifyAsoPlanAction } from "@/actions/aso-panel";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { JUSTIFY_REASONS } from "@/lib/aso/execution";
import { humanizeLabel } from "@/lib/labels";
import type { PlanRef } from "./aso-register-dialog";

type JustifyState = { error?: string; ok?: boolean; message?: string };
const initial: JustifyState = {};

export function AsoJustifyDialog({
  plan,
  trigger,
}: {
  plan: PlanRef;
  trigger?: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, formAction, pending] = useActionState(justifyAsoPlanAction, initial);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  const selected = JUSTIFY_REASONS.find((r) => r.value === reason);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm" variant="outline" className="h-7 text-[12px]">
              Justificar
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Justificar ASO não realizado</DialogTitle>
          <DialogDescription>
            {plan.employeeName} ({plan.registration}) · {humanizeLabel(plan.asoType)}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="planId" value={plan.id} />
          <div className="space-y-1">
            <Label htmlFor="reason">Motivo *</Label>
            <select
              id="reason"
              name="reason"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-8 w-full rounded-lg border border-slate-200 px-2 text-sm"
            >
              <option value="">—</option>
              {JUSTIFY_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Observação *</Label>
            <Textarea
              id="notes"
              name="notes"
              required
              placeholder="Detalhe o motivo da justificativa"
            />
          </div>
          {selected ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
              {selected.excludesDenominator ? (
                <>
                  Este motivo <strong>pode retirar</strong> o colaborador do denominador
                  (elegíveis).
                  <label className="mt-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="excludeDenominator"
                      value="1"
                      defaultChecked
                    />
                    Excluir do denominador
                  </label>
                </>
              ) : (
                <>
                  Este motivo <strong>não exclui</strong> automaticamente do denominador
                  (ex.: recusa ou falta). O item permanece elegível.
                  <input type="hidden" name="excludeDenominator" value="0" />
                </>
              )}
            </div>
          ) : null}
          {state.error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="bg-teal-700 hover:bg-teal-800"
            >
              {pending ? "Salvando..." : "Confirmar justificativa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
