"use client";

import { Baby } from "lucide-react";
import { PregnancyRegisterDialog } from "@/components/pregnancy/pregnancy-register-dialog";

export function PregnancyPanelHeader({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-primary-border bg-primary-soft text-primary">
          <Baby className="size-4" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Gestantes
          </h2>
          <p className="text-[12px] text-muted-foreground">
            Comunicação, realocação de insalubridade e acompanhamento da gestação.
          </p>
        </div>
      </div>
      {canCreate ? <PregnancyRegisterDialog /> : null}
    </div>
  );
}
