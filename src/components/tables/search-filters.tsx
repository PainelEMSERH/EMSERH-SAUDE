import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
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
    <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <form
        action={action}
        method="get"
        className="flex flex-col gap-3 lg:flex-row lg:items-end"
      >
        <div className="flex-1 space-y-1.5">
          <label
            htmlFor="filter-q"
            className="text-xs font-medium text-slate-500"
          >
            Busca
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="filter-q"
              name="q"
              defaultValue={q ?? ""}
              placeholder={placeholder}
              className="h-10 pl-9"
            />
          </div>
        </div>
        {statusOptions?.length ? (
          <div className="w-full space-y-1.5 lg:w-48">
            <label
              htmlFor="filter-status"
              className="text-xs font-medium text-slate-500"
            >
              Situação
            </label>
            <select
              id="filter-status"
              name="status"
              defaultValue={status || "ALL"}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:border-teal-600 focus-visible:ring-3 focus-visible:ring-teal-600/20"
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
          <div className="w-full space-y-1.5 lg:w-48">
            <label
              htmlFor="filter-type"
              className="text-xs font-medium text-slate-500"
            >
              {typeLabel}
            </label>
            <select
              id="filter-type"
              name={typeName}
              defaultValue={type || "ALL"}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus-visible:border-teal-600 focus-visible:ring-3 focus-visible:ring-teal-600/20"
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
        <div className="flex gap-2">
          <Button
            type="submit"
            className="h-10 bg-teal-700 hover:bg-teal-800"
          >
            Filtrar
          </Button>
          {hasActive ? (
            <Link
              href={action}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-10",
              )}
            >
              Limpar filtros
            </Link>
          ) : null}
        </div>
      </form>
      {resultCount != null ? (
        <p className="text-sm text-slate-500">
          <span className="font-medium text-slate-700">
            {resultCount.toLocaleString("pt-BR")}
          </span>{" "}
          {resultLabel}
          {hasActive ? " com os filtros atuais" : ""}
        </p>
      ) : null}
    </div>
  );
}
