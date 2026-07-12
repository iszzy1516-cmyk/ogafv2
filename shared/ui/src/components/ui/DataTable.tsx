import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "../../utils/cn";
import { PAGE_SIZES } from "../../utils/constants";

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (column: string) => void;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  page,
  perPage,
  total,
  onPageChange,
  onPerPageChange,
  sortColumn,
  sortDirection,
  onSort,
  emptyMessage = "No records found.",
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr className="border-b border-gray-200">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-gray-600",
                    column.sortable && "cursor-pointer select-none hover:text-oagf-green",
                  )}
                  style={{ width: column.width, minWidth: column.width }}
                  onClick={() => column.sortable && onSort?.(column.key)}
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    {column.header}
                    {column.sortable && sortColumn === column.key && (
                      <span className="text-oagf-green">{sortDirection === "asc" ? "↑" : "↓"}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-sm text-oagf-grey">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={keyExtractor(row)}
                  className={cn("transition-colors hover:bg-green-50/40", idx % 2 === 1 && "bg-gray-50/50")}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="whitespace-nowrap px-6 py-4 text-sm text-gray-700"
                    >
                      {column.render ? column.render(row, idx) : (row as Record<string, unknown>)[column.key] as React.ReactNode}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 border-t border-oagf-border bg-gray-50/50 px-5 py-3.5 sm:flex-row">
        <div className="flex items-center gap-2 text-sm text-oagf-grey">
          <span>
            Showing <span className="font-medium text-gray-700">{start}</span> to{" "}
            <span className="font-medium text-gray-700">{end}</span> of{" "}
            <span className="font-medium text-gray-700">{total}</span> entries
          </span>
          <select
            value={perPage}
            onChange={(e) => onPerPageChange(parseInt(e.target.value, 10))}
            className="rounded-md border border-oagf-border bg-white px-2.5 py-1.5 text-sm focus:border-oagf-green focus:outline-none focus:ring-1 focus:ring-oagf-green"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            className="rounded-md p-1.5 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronsLeft size={18} />
          </button>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-md p-1.5 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="px-3 text-sm font-medium text-oagf-text">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded-md p-1.5 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
            className="rounded-md p-1.5 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronsRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
