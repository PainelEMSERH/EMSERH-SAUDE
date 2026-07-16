import {
  EmptyState,
  PageHeader,
} from "@/components/feedback/setup-banner";
import { isDatabaseConfigured } from "@/lib/env";

type ModulePageProps = {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
};

export function ModulePlaceholder({
  title,
  description,
  emptyTitle,
  emptyDescription,
}: ModulePageProps) {
  const configured = isDatabaseConfigured();
  return (
    <div>
      <PageHeader title={title} description={description} />
      <EmptyState
        title={configured ? emptyTitle : "Aguardando conexão com o Neon"}
        description={
          configured
            ? emptyDescription
            : "Este módulo já está modelado e protegido. Após configurar o banco e importar os dados, a listagem operacional aparece aqui."
        }
      />
    </div>
  );
}
