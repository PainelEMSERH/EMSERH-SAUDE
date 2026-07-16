import { LoginForm } from "@/components/forms/login-form";
import { isAuthConfigured, isDatabaseConfigured } from "@/lib/env";

export default function LoginPage() {
  const ready = isDatabaseConfigured() && isAuthConfigured();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.35),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(15,118,110,0.25),_transparent_40%)]" />
      <div className="relative z-10 w-full max-w-md space-y-4">
        {!ready ? (
          <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
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
