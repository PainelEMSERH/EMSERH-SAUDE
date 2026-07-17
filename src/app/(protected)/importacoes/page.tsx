import { PageHeader } from "@/components/feedback/setup-banner";
import { MirrorSyncForm } from "@/components/forms/mirror-sync-form";
import { requirePermission, userCan } from "@/lib/auth/guard";

export default async function ImportacoesPage() {
  const user = await requirePermission("imports", "view");
  const canSync = userCan(user, "imports", "sync_global");
  const sheetConfigured = Boolean(process.env.ALTERDATA_MIRROR_SHEET_ID?.trim());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importações"
        description="Sincronização somente-leitura do espelho Alterdata (IMPORTRANGE). A planilha oficial não é tocada."
      />

      <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-5">
        <h3 className="font-semibold text-teal-950">Espelho Google Sheets</h3>
        <p className="mt-1 text-sm text-teal-900/80">
          Fonte: variável <code className="text-xs">ALTERDATA_MIRROR_SHEET_ID</code>{" "}
          ({sheetConfigured ? "configurada" : "não configurada"}). Modo:{" "}
          <strong>GET CSV apenas</strong> — zero escrita no Google. Execução
          restrita a administradores centrais.
        </p>
        <div className="mt-4">
          {canSync ? (
            <MirrorSyncForm />
          ) : (
            <p className="text-sm text-teal-900/80">
              Seu perfil pode consultar o histórico, mas não executar a
              sincronização global.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <p>Importação local (alternativa / carga histórica):</p>
        <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
{`npm run sync:mirror
npm run sync:mirror:fast
npm run import:employees -- --file=./planilha.xlsx --yes
npm run import:occupational -- --file=./planilha.xlsx --yes`}
        </pre>
      </div>
    </div>
  );
}
