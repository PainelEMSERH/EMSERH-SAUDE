import { ModulePlaceholder } from "@/components/feedback/module-placeholder";

export default function AdministracaoPage() {
  return (
    <ModulePlaceholder
      title="Administração"
      description="Usuários, perfis, regionais, unidades, parâmetros e metas."
      emptyTitle="Área administrativa"
      emptyDescription="Após o Neon, o SUPER_ADMIN cria usuários e define escopos regionais/unidades."
    />
  );
}
