"use client";

import { useState, useTransition } from "react";
import { syncAlterdataMirrorAction } from "@/actions/mirror-sync";
import { Button } from "@/components/ui/button";

export function MirrorSyncForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <Button
        type="button"
        disabled={pending}
        className="bg-primary hover:bg-primary-hover"
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
        {pending ? "Sincronizando espelho..." : "Sincronizar espelho Alterdata"}
      </Button>
      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md bg-primary-soft px-3 py-2 text-sm text-primary">
          {message}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Somente leitura (HTTP GET). A planilha oficial nunca é acessada. No
        espelho: Compartilhar → Qualquer pessoa com o link → Leitor.
      </p>
    </div>
  );
}
