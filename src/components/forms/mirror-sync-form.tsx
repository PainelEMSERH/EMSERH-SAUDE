"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { syncAlterdataMirrorAction } from "@/actions/mirror-sync";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MirrorSyncForm({
  sheetConfigured,
}: {
  sheetConfigured: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={pending || !sheetConfigured}
          className="h-9 gap-2 bg-primary hover:bg-primary-hover"
          onClick={() => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await syncAlterdataMirrorAction();
              if (result.error) setError(result.error);
              if (result.ok && result.message) setMessage(result.message);
            });
          }}
        >
          <RefreshCw
            className={cn("size-3.5", pending && "animate-spin")}
          />
          {pending ? "Sincronizando…" : "Sincronizar espelho"}
        </Button>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium",
            sheetConfigured
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              sheetConfigured ? "bg-emerald-500" : "bg-amber-500",
            )}
          />
          {sheetConfigured ? "Espelho configurado" : "Espelho não configurado"}
        </span>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
          {message}
        </p>
      ) : null}

      <p className="text-[12px] leading-relaxed text-slate-500">
        Atualiza colaboradores a partir do espelho Alterdata (somente leitura).
        A planilha oficial não é alterada.
      </p>
    </div>
  );
}
