import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function SetupBanner() {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
      <Alert className="border-amber-200 bg-transparent">
        <AlertTitle>Configuração pendente (Neon)</AlertTitle>
        <AlertDescription>
          O código está pronto. Configure <code>DATABASE_URL</code>,{" "}
          <code>AUTH_SECRET</code> e <code>FIELD_ENCRYPTION_KEY</code> no
          ambiente (local/Vercel) e rode as migrações antes do uso operacional.{" "}
          <Link href="/login" className="underline">
            Ir para login
          </Link>
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-[12px] text-slate-500">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}
