import { LoginForm } from "@/components/forms/login-form";
import { isAuthConfigured, isDatabaseConfigured } from "@/lib/env";

export default function LoginPage() {
  const ready = isDatabaseConfigured() && isAuthConfigured();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f6fa] px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(5,150,105,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(15,23,42,0.04),_transparent_45%)]" />
      <div className="relative z-10 w-full max-w-md space-y-4">
        {!ready ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Neon e autenticação ainda não configurados neste ambiente. O login
            ficará disponível após <code>DATABASE_URL</code> e{" "}
            <code>AUTH_SECRET</code>.
          </div>
        ) : null}
        <LoginForm />
      </div>
    </div>
  );
}
