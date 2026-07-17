"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { registerAsoRealizationAction } from "@/actions/aso-panel";
import { createAsoAction } from "@/actions/occupational";
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
import { ASO_TYPES } from "@/lib/aso/constants";
import { humanizeLabel } from "@/lib/labels";

export type PlanRef = {
  id: string;
  registration: string;
  employeeName: string;
  asoType: string;
};

type RegisterState = { error?: string; ok?: boolean; message?: string };
const initial: RegisterState = {};

/**
 * Registra a realização de um ASO. Quando `plan` é informado, vincula ao
 * item de planejamento (registerAsoRealizationAction). Sem `plan`, cria um
 * registro ad-hoc via createAsoAction (usado no cabeçalho do painel).
 */
export function AsoRegisterDialog({
  plan,
  trigger,
}: {
  plan?: PlanRef;
  trigger?: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const action = plan ? registerAsoRealizationAction : createAsoAction;
  const [state, formAction, pending] = useActionState(action, initial);

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
            <Button size="sm" className="h-8 bg-primary text-[13px] hover:bg-primary-hover">
              Registrar ASO
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar realização de ASO</DialogTitle>
          <DialogDescription>
            {plan
              ? `${plan.employeeName} (${plan.registration}) · ${humanizeLabel(plan.asoType)}`
              : "Somente a data realizada avança o próximo vencimento."}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          {plan ? (
            <input type="hidden" name="planId" value={plan.id} />
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="registration">Matrícula</Label>
                <Input id="registration" name="registration" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="asoType">Tipo de ASO</Label>
                <select
                  id="asoType"
                  name="asoType"
                  required
                  className="h-8 w-full rounded-lg border border-border px-2 text-sm"
                >
                  {ASO_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {humanizeLabel(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="expectedDate">Data prevista (opcional)</Label>
                <Input id="expectedDate" name="expectedDate" type="date" />
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label htmlFor="performedDate">Data realizada</Label>
            <Input id="performedDate" name="performedDate" type="date" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="periodicityMonths">Periodicidade (meses)</Label>
              <Input
                id="periodicityMonths"
                name="periodicityMonths"
                type="number"
                min={1}
                max={60}
                defaultValue={12}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="result">Resultado</Label>
              <select
                id="result"
                name="result"
                className="h-8 w-full rounded-lg border border-border px-2 text-sm"
              >
                <option value="">—</option>
                <option value="APTO">Apto</option>
                <option value="INAPTO">Inapto</option>
                <option value="APTO_COM_RESTRICAO">Apto com restrição</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="adminNotes">Observação administrativa</Label>
            <Textarea id="adminNotes" name="adminNotes" />
          </div>
          {state.error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700 dark:border-[color:var(--danger)] dark:bg-transparent dark:text-[color:var(--danger)]">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="submit"
              disabled={pending}
              className="bg-primary hover:bg-primary-hover"
            >
              {pending ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
