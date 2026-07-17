import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
}: {
  columns: Column<T>[];
  rows: T[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-slate-200 bg-slate-50 hover:bg-slate-50">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  "h-8 px-2.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase",
                  col.className,
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className="border-slate-100 transition-colors hover:bg-teal-50/50"
            >
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn(
                    "h-9 px-2.5 py-1.5 align-middle text-[13px]",
                    col.className,
                  )}
                >
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
