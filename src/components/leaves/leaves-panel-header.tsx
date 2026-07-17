"use client";

import { CalendarOff } from "lucide-react";
import { LeavesRegisterDialog } from "@/components/leaves/leaves-register-dialog";

export function LeavesPanelHeader({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-teal-100 bg-teal-50 text-teal-800">
          <CalendarOff className="size-4" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Afastamentos
          </h2>
          <p className="text-[12px] text-slate-500">
            Atestados, INSS, licenças e retornos com acompanhamento operacional.
          </p>
        </div>
      </div>
      {canCreate ? <LeavesRegisterDialog /> : null}
    </div>
  );
}
