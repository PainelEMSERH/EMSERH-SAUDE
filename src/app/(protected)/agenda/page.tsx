import { ModulePlaceholder } from "@/components/feedback/module-placeholder";

export default function AgendaPage() {
  return (
    <ModulePlaceholder
      title="Agenda médica"
      description="Agendamentos por profissional, unidade, presença e conduta."
      emptyTitle="Agenda sem marcação"
      emptyDescription="Cadastre disponibilidade e consultas. O sistema impede dupla marcação do mesmo profissional no mesmo horário."
    />
  );
}
