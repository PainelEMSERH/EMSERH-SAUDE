import { PageHeader } from "@/components/feedback/setup-banner";
import { ChangePasswordForm } from "@/components/forms/change-password-form";

export default function TrocarSenhaPage() {
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader
        title="Trocar senha"
        description="Por segurança, defina uma nova senha antes de continuar."
      />
      <div className="app-surface px-5 py-5">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
