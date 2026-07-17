import { PageHeader } from "@/components/feedback/setup-banner";
import { MirrorSyncForm } from "@/components/forms/mirror-sync-form";
import { requirePermission } from "@/lib/auth/guard";
import { MIRROR_SHEET_ID_DEFAULT } from "@/lib/sheets/mirror-sync";

export default async function ImportacoesPage() {
  await requirePermission("imports", "view");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importações"
        description="Sincronização somente-leitura do espelho Alterdata (IMPORTRANGE). A planilha oficial não é tocada."
      />

      <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-5">
        <h3 className="font-semibold text-teal-950">Espelho Google Sheets</h3>
        <p className="mt-1 text-sm text-teal-900/80">
          Fonte: espelho com IMPORTRANGE (ID{" "}
          <code className="text-xs">{MIRROR_SHEET_ID_DEFAULT}</code>). Modo:{" "}
          <strong>GET CSV apenas</strong> — zero escrita no Google.
        </p>
        <div className="mt-4">
          <MirrorSyncForm />
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <p>Importação local (alternativa / carga histórica):</p>
        <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
{`npm run sync:mirror
npm run import:employees -- --file=./planilha.xlsx --yes
npm run import:occupational -- --file=./planilha.xlsx --yes`}
        </pre>
      </div>
    </div>
  );
}
