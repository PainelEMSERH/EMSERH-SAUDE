"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { reprogramAsoPlanAction } from "@/actions/aso-panel";
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
import { formatDateBR } from "@/lib/dates";
import { humanizeLabel } from "@/lib/labels";
import type { PlanRef } from "./aso-register-dialog";

type State = { error?: string; ok?: boolean; message?: string };
const initial: State = {};

export function AsoReprogramDialog({
  plan,
  trigger,
}: {
  plan: PlanRef & { expectedDate?: string | null; year?: number; month?: number };
  trigger?: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(reprogramAsoPlanAction, initial);

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
          trigger ?? (
            <Button size="sm" variant="outline" className="h-7 text-[12px]">
              Reprogramar
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reprogramar ASO</DialogTitle>
          <DialogDescription>
            {plan.employeeName} · {humanizeLabel(plan.asoType)} · Previsto original:{" "}
            {formatDateBR(plan.expectedDate)}
            {plan.year && plan.month
              ? ` · Competência ${String(plan.month).padStart(2, "0")}/${plan.year}`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="planId" value={plan.id} />
          <p className="rounded-md border border-border bg-muted px-3 py-2 text-[12px] text-muted-foreground">
            A competência original e a data prevista histórica serão preservadas para
            aderência. A nova data gera item na competência correspondente.
          </p>
          <div className="space-y-1">
            <Label htmlFor="newDate">Nova data *</Label>
            <input
              id="newDate"
              name="newDate"
              type="date"
              required
              className="h-8 w-full rounded-lg border border-border px-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="reason">Motivo *</Label>
            <input
              id="reason"
              name="reason"
              required
              className="h-8 w-full rounded-lg border border-border px-2 text-sm"
              placeholder="Motivo da reprogramação"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Observação</Label>
            <Textarea id="notes" name="notes" placeholder="Detalhes adicionais" />
          </div>
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
              className="bg-primary hover:bg-primary-hover"
            >
              {pending ? "Salvando..." : "Confirmar reprogramação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
