import { ModulePlaceholder } from "@/components/feedback/module-placeholder";

export default function MaterialBiologicoPage() {
  return (
    <ModulePlaceholder
      title="Material biológico"
      description="Acidentes, PEP, CAT e acompanhamentos automáticos de 30, 60 e 90 dias."
      emptyTitle="Nenhum acidente registrado"
      emptyDescription="Ao cadastrar um acidente, o sistema gera automaticamente os três acompanhamentos com vencimento."
    />
  );
}
