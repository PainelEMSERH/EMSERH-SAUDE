"use client";

import { ShieldAlert } from "lucide-react";
import { BiologicalRegisterDialog } from "@/components/biological/biological-register-dialog";

export function BiologicalPanelHeader({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-teal-100 bg-teal-50 text-teal-800">
          <ShieldAlert className="size-4" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Material biológico
          </h2>
          <p className="text-[12px] text-slate-500">
            Exposições, PEP, CAT e acompanhamentos D30 / D60 / D90.
          </p>
        </div>
      </div>
      {canCreate ? <BiologicalRegisterDialog /> : null}
    </div>
  );
}
