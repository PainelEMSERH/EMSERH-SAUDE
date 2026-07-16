import { ModulePlaceholder } from "@/components/feedback/module-placeholder";

export default function AtendimentosPage() {
  return (
    <ModulePlaceholder
      title="Atendimentos"
      description="Atendimentos ambulatoriais, externos, notificações e Espaço Cuidar."
      emptyTitle="Sem atendimentos no período"
      emptyDescription="Registros operacionais e de comissões entram aqui após cadastro ou importação."
    />
  );
}
