import { ModulePlaceholder } from "@/components/feedback/module-placeholder";

export default function IndicadoresPage() {
  return (
    <ModulePlaceholder
      title="Indicadores"
      description="Catálogo institucional com metas, fórmulas rastreáveis e regras pendentes de validação."
      emptyTitle="Indicadores aguardando carga"
      emptyDescription="Regras não validadas (ex.: aderência ASO e notificações) aparecem sinalizadas — nunca inventadas."
    />
  );
}
