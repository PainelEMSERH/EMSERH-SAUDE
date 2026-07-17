import { PageHeader } from "@/components/feedback/setup-banner";
import { requirePermission } from "@/lib/auth/guard";

export default async function ImportacoesPage() {
  await requirePermission("imports", "view");

  return (
    <div>
      <PageHeader
        title="Importações"
        description="Migração inicial via scripts locais (idempotentes e com confirmação no terminal)."
      />
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <p>
          Para evitar upload de planilhas grandes em Serverless Function, a
          importação roda na máquina local apontando para o Neon:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
{`# Colaboradores / Extração Alterdata
npm run import:employees -- --file=./planilha.xlsx --sheet="Extração Alterdata" --yes

# Dados ocupacionais (ASO, agenda, afastados, vacinas, gestantes, material biológico)
npm run import:occupational -- --file=./planilha.xlsx --yes

# Definições de indicadores
npm run import:indicators -- --yes`}
        </pre>
        <ul className="list-disc space-y-1 pl-5">
          <li>Valida cabeçalhos e normaliza textos/regionais.</li>
          <li>Não grava sem `--yes` (confirmação explícita).</li>
          <li>Registra lote em `files.import_batches` com totais e erros.</li>
          <li>Relatório de erros em `./import-reports/` (fora do Git).</li>
        </ul>
      </div>
    </div>
  );
}
