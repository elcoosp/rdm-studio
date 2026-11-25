import type { JSX } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";

import { cn } from "@/lib/cn";

/**
 * TanStack Table wrapper (v1.4.0): `tabular-nums` numeric cells,
 * Shift+Click range row selection, hairline row dividers.
 */
export function DataTable<T>({
  columns,
  data,
  rowSelection,
  onRowSelectionChange,
  enableRowSelection = false,
  className,
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (next: RowSelectionState) => void;
  enableRowSelection?: boolean;
  className?: string;
}) {
  const table = useReactTable({
    data,
    columns,
    state: rowSelection === undefined ? undefined : { rowSelection },
    onRowSelectionChange:
      onRowSelectionChange === undefined
        ? undefined
        : (updater) => {
            const next = typeof updater === "function" ? updater(rowSelection ?? {}) : updater;
            onRowSelectionChange(next);
          },
    enableRowSelection,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className={cn("overflow-auto", className)}>
      <table className="w-full text-[13px]">
        <thead className="text-left text-[11px] text-ink-muted">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="py-1 pr-2 font-normal">
                  {header.column.columnDef.meta === undefined ||
                  (header.column.columnDef.meta as { numeric?: boolean }).numeric !== true ? (
                    flexRender(header.column.columnDef.header, header.getContext())
                  ) : (
                    <span className="font-data">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="font-data">
          {table.getRowModel().rows.map((row, rowIndex) => (
            <tr
              key={row.id}
              data-testid={`data-row-${row.id}`}
              className={cn(
                "border-t border-hairline transition-colors",
                row.getIsSelected() ? "bg-accent-tint" : "hover:bg-canvas",
              )}
              onClick={(event) => {
                if (!enableRowSelection) {
                  return;
                }
                // Shift+Click extends the selection to the clicked row.
                if (event.shiftKey) {
                  const next = { ...(rowSelection ?? {}) };
                  next[row.id] = true;
                  onRowSelectionChange?.(next);
                } else {
                  onRowSelectionChange?.({ [row.id]: !row.getIsSelected() });
                }
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="py-1 pr-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
