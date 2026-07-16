import { ModulePlaceholder } from "@/components/feedback/module-placeholder";

export default function ImportacoesPage() {
  return (
    <ModulePlaceholder
      title="Importações"
      description="Lotes rastreáveis e idempotentes a partir do Alterdata e das planilhas atuais."
      emptyTitle="Nenhum lote importado"
      emptyDescription="Use os scripts locais (tsx) para migração inicial — evita enviar planilhas grandes por Serverless Function."
    />
  );
}
