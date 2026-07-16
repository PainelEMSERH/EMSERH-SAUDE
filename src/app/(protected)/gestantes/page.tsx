import { ModulePlaceholder } from "@/components/feedback/module-placeholder";

export default function GestantesPage() {
  return (
    <ModulePlaceholder
      title="Gestantes"
      description="Comunicação, realocação, insalubridade, licença e alertas."
      emptyTitle="Nenhuma gestante em acompanhamento"
      emptyDescription="Casos em atividade insalubre sem realocação geram alerta automático no dashboard."
    />
  );
}
