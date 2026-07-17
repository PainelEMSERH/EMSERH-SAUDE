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
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
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
    <div className="app-page-header">
      <div className="min-w-0">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
