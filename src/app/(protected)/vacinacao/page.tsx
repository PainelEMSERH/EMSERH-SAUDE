import { ModulePlaceholder } from "@/components/feedback/module-placeholder";

export default function VacinacaoPage() {
  return (
    <ModulePlaceholder
      title="Vacinação"
      description="Doses independentes, recusas, Anti-HBs e pendências por regra configurável."
      emptyTitle="Cartão vacinal ainda vazio"
      emptyDescription="A situação vacinal será calculada por regras institucionais. Enquanto não validadas, o status permanece sinalizado."
    />
  );
}
