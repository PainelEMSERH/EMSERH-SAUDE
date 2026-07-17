import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SearchFilters({
  action,
  q,
  status,
  statusOptions,
  type,
  typeOptions,
  typeName = "type",
  typeLabel = "Tipo",
}: {
  action: string;
  q?: string;
  status?: string;
  statusOptions?: { value: string; label: string }[];
  type?: string;
  typeOptions?: { value: string; label: string }[];
  typeName?: string;
  typeLabel?: string;
}) {
  return (
    <form
      action={action}
      method="get"
      className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-end"
    >
      <div className="flex-1 space-y-1">
        <label className="text-xs font-medium text-slate-500">Busca</label>
        <Input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Matrícula, nome..."
        />
      </div>
      {statusOptions?.length ? (
        <div className="w-full space-y-1 sm:w-48">
          <label className="text-xs font-medium text-slate-500">Situação</label>
          <select
            name="status"
            defaultValue={status || "ALL"}
            className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
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
        <div className="w-full space-y-1 sm:w-48">
          <label className="text-xs font-medium text-slate-500">
            {typeLabel}
          </label>
          <select
            name={typeName}
            defaultValue={type || "ALL"}
            className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
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
      <Button type="submit" className="bg-teal-700 hover:bg-teal-800">
        Filtrar
      </Button>
    </form>
  );
}
