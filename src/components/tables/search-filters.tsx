import Link from "next/link";
import { Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SearchFilters({
  action,
  q,
  status,
  statusOptions,
  type,
  typeOptions,
  typeName = "type",
  typeLabel = "Tipo",
  placeholder = "Matrícula, nome...",
  resultCount,
  resultLabel = "resultados",
}: {
  action: string;
  q?: string;
  status?: string;
  statusOptions?: { value: string; label: string }[];
  type?: string;
  typeOptions?: { value: string; label: string }[];
  typeName?: string;
  typeLabel?: string;
  placeholder?: string;
  resultCount?: number;
  resultLabel?: string;
}) {
  const hasActive =
    Boolean(q?.trim()) ||
    Boolean(status && status !== "ALL") ||
    Boolean(type && type !== "ALL");

  return (
    <div className="mb-3 space-y-2 rounded-lg border border-border bg-card p-3">
      <form
        action={action}
        method="get"
        className="flex flex-col gap-2 lg:flex-row lg:items-end"
      >
        <div className="flex-1 space-y-1">
          <label
            htmlFor="filter-q"
            className="text-[11px] font-medium text-muted-foreground"
          >
            Busca
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="filter-q"
              name="q"
              defaultValue={q ?? ""}
              placeholder={placeholder}
              className="h-8 pl-8 text-[13px]"
            />
          </div>
        </div>
        {statusOptions?.length ? (
          <div className="w-full space-y-1 lg:w-40">
            <label
              htmlFor="filter-status"
              className="text-[11px] font-medium text-muted-foreground"
            >
              Situação
            </label>
            <select
              id="filter-status"
              name="status"
              defaultValue={status || "ALL"}
              className="h-8 w-full rounded-md border border-border bg-card px-2 text-[13px] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              <option value="ALL">Todas</option>
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {typeOptions?.length ? (
          <div className="w-full space-y-1 lg:w-40">
            <label
              htmlFor="filter-type"
              className="text-[11px] font-medium text-muted-foreground"
            >
              {typeLabel}
            </label>
            <select
              id="filter-type"
              name={typeName}
              defaultValue={type || "ALL"}
              className="h-8 w-full rounded-md border border-border bg-card px-2 text-[13px] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              <option value="ALL">Todos</option>
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="flex gap-1.5">
          <Button
            type="submit"
            size="sm"
            className="h-8 bg-primary px-3 text-[13px] hover:bg-primary-hover"
          >
            Filtrar
          </Button>
          {hasActive ? (
            <Link
              href={action}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-8 text-[13px]",
              )}
            >
              Limpar
            </Link>
          ) : null}
        </div>
      </form>
      {resultCount != null ? (
        <p className="text-[12px] text-muted-foreground">
          <span className="font-medium text-foreground/80">
            {resultCount.toLocaleString("pt-BR")}
          </span>{" "}
          {resultLabel}
          {hasActive ? " com os filtros atuais" : ""}
        </p>
      ) : null}
    </div>
  );
}
