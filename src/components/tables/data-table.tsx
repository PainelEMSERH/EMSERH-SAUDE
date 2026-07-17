import { EmptyState } from "@/components/feedback/setup-banner";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  className?: string;
  cell: (row: T) => React.ReactNode;
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  emptyTitle = "Nenhum registro",
  emptyDescription = "Não há dados para exibir com os filtros atuais.",
  stickyHeader = false,
  /**
   * page — cabeçalho sticky na rolagem do contêiner pai (sem scroll interno).
   * container — caixa interna com max-height + overflow (comportamento legado).
   */
  stickyHeaderMode = "page",
  maxHeightClassName = "max-h-[calc(100vh-240px)]",
  tableLayout = "auto",
  containerClassName,
  tableClassName,
  cellClassName,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyTitle?: string;
  emptyDescription?: string;
  stickyHeader?: boolean;
  stickyHeaderMode?: "page" | "container";
  maxHeightClassName?: string;
  tableLayout?: "auto" | "fixed";
  containerClassName?: string;
  tableClassName?: string;
  cellClassName?: string;
}) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const useInnerScroll = stickyHeader && stickyHeaderMode === "container";

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white",
        useInnerScroll
          ? cn("overflow-auto", maxHeightClassName)
          : "overflow-hidden",
        containerClassName,
      )}
    >
      <table
        className={cn(
          "w-full caption-bottom text-sm",
          tableLayout === "fixed" && "table-fixed",
          tableClassName,
        )}
      >
        <thead
          className={cn(
            stickyHeader &&
              "sticky top-0 z-20 border-b border-slate-200 bg-slate-50 shadow-[0_1px_0_0_rgb(226_232_240)]",
          )}
        >
          <tr className="border-b border-slate-200 bg-slate-50 hover:bg-slate-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "h-8 px-2.5 text-center align-middle text-[11px] font-semibold tracking-wide text-slate-500 uppercase",
                  stickyHeader && "bg-slate-50",
                  col.className,
                  "text-center",
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-slate-100 transition-colors hover:bg-teal-50/50"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "h-9 px-2.5 py-1.5 align-middle text-[12px]",
                    cellClassName,
                    col.className,
                  )}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
