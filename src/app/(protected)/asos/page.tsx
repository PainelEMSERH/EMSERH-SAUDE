import { ModulePlaceholder } from "@/components/feedback/module-placeholder";

export default function AsosPage() {
  return (
    <ModulePlaceholder
      title="ASOs"
      description="Controle de exames ocupacionais, vencimentos, convocações e lançamento no Alterdata."
      emptyTitle="Nenhum ASO registrado"
      emptyDescription="Após a importação/cadastro, os status Em dia, A vencer e Vencido serão calculados com meses reais."
    />
  );
}
