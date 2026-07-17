"use client";

import { ShieldAlert } from "lucide-react";
import { BiologicalRegisterDialog } from "@/components/biological/biological-register-dialog";

export function BiologicalPanelHeader({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-primary-border bg-primary-soft text-primary">
          <ShieldAlert className="size-4" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Material biológico
          </h2>
          <p className="text-[12px] text-muted-foreground">
            Exposições, PEP, CAT e acompanhamentos D30 / D60 / D90.
          </p>
        </div>
      </div>
      {canCreate ? <BiologicalRegisterDialog /> : null}
    </div>
  );
}
