import { ModulePlaceholder } from "@/components/feedback/module-placeholder";

export default function RelatoriosPage() {
  return (
    <ModulePlaceholder
      title="Relatórios"
      description="Exportações CSV/XLSX com escopo, permissão e auditoria."
      emptyTitle="Nenhum relatório gerado"
      emptyDescription="Exportações mascaram CPF/CNS por padrão e registram auditoria de download."
    />
  );
}
