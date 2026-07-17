"use client";

import { Syringe } from "lucide-react";
import { VaccinationRegisterDialog } from "@/components/vaccination/vaccination-register-dialog";

export function VaccinationPanelHeader({
  canCreate,
}: {
  canCreate: boolean;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-teal-100 bg-teal-50 text-teal-800">
          <Syringe className="size-4" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Vacinação
          </h2>
          <p className="text-[12px] text-slate-500">
            Carteira completa por colaborador — veja de uma vez se o kit está em dia.
          </p>
        </div>
      </div>
      {canCreate ? <VaccinationRegisterDialog /> : null}
    </div>
  );
}
