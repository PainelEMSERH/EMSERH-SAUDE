import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  totalPages,
  basePath,
  searchParams,
  total,
  pageSize,
  itemLabel = "registros",
}: {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
  total?: number;
  pageSize?: number;
  itemLabel?: string;
}) {
  function href(p: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams ?? {})) {
      if (v && v !== "ALL" && k !== "page") params.set(k, v);
    }
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  }

  const size = pageSize ?? 20;
  const from = total && total > 0 ? (page - 1) * size + 1 : 0;
  const to = total ? Math.min(page * size, total) : 0;

  if (totalPages <= 1 && (total == null || total === 0)) return null;

  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="text-sm text-slate-500">
        {total != null
          ? `Mostrando ${from}–${to} de ${total} ${itemLabel}`
          : `Página ${page} de ${totalPages}`}
      </p>
      {totalPages > 1 ? (
        <div className="flex gap-2">
          {page <= 1 ? (
            <span
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "pointer-events-none opacity-50",
              )}
            >
              Anterior
            </span>
          ) : (
            <Link
              href={href(page - 1)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Anterior
            </Link>
          )}
          {page >= totalPages ? (
            <span
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "pointer-events-none opacity-50",
              )}
            >
              Próxima
            </span>
          ) : (
            <Link
              href={href(page + 1)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Próxima
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
