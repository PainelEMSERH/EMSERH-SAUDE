"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guard";
import { syncAlterdataMirror } from "@/lib/sheets/mirror-sync";

export type MirrorSyncState = {
  error?: string;
  ok?: boolean;
  message?: string;
};

export async function syncAlterdataMirrorAction(): Promise<MirrorSyncState> {
  try {
    const user = await requirePermission("imports", "sync_global");
    const result = await syncAlterdataMirror({ user });
    if (!result.ok) {
      return { error: result.error ?? "Falha na sincronização." };
    }
    revalidatePath("/colaboradores");
    revalidatePath("/importacoes");
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: `Sync OK: ${result.imported} novos, ${result.updated} atualizados, ${result.skipped} ignorados, ${result.errors} erros (total ${result.totalRows}).`,
    };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "Falha ao sincronizar o espelho Alterdata.",
    };
  }
}
