import Link from "next/link";
import { Database } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";

export default async function NovoColaboradorPage() {
  await requirePermission("employees", "view");

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-lg border border-border bg-card p-6">
      <div className="flex size-10 items-center justify-center rounded-md border border-primary-border bg-primary-soft text-primary">
        <Database className="size-5" aria-hidden />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Cadastro pelo Alterdata
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Os colaboradores são cadastrados exclusivamente pelo Alterdata. O
          sistema importa e atualiza os dados a partir do espelho oficial —
          não há cadastro manual nesta aplicação.
        </p>
      </div>
      <Link
        href="/colaboradores"
        className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover"
      >
        Voltar para colaboradores
      </Link>
    </div>
  );
}
