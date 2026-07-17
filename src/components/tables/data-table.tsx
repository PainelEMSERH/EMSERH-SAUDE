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
  tableLayout = "fixed",
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
        "rounded-lg border border-border bg-card",
        useInnerScroll
          ? cn("overflow-auto", maxHeightClassName)
          : "overflow-hidden",
        containerClassName,
      )}
    >
      <table
        className={cn(
          "app-data-table",
          tableLayout === "auto" && "[table-layout:auto]",
          tableClassName,
        )}
      >
        <thead
          className={cn(
            stickyHeader &&
              "sticky top-0 z-20 shadow-[0_1px_0_0_var(--border)]",
          )}
        >
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  stickyHeader && "bg-[#f7f7f7] dark:bg-[#1c1c1c]",
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
            <tr key={row.id}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(cellClassName, col.className)}
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
