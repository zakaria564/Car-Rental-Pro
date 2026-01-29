"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Payment } from "@/lib/definitions";
import { formatCurrency, cn } from "@/lib/utils";

export const columns: ColumnDef<Payment>[] = [
    {
      accessorKey: "rentalId",
      header: "Contrat ID",
      cell: ({ row }) => <div className="font-mono text-xs">{row.original.rentalId?.substring(0, 8).toUpperCase()}</div>,
    },
    {
      accessorKey: "clientName",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Client
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="font-medium">{row.getValue("clientName")}</div>,
    },
    {
      accessorKey: "paymentDate",
      header: "Date de paiement",
      cell: ({ row }) => {
          const date = row.original.paymentDate;
          if (date && date.toDate) {
            return format(date.toDate(), "dd/MM/yyyy", { locale: fr });
          }
          return "N/A";
      }
    },
    {
      accessorKey: "amount",
      header: () => <div className="text-right">Montant</div>,
      cell: ({ row }) => (
        <div className="text-right font-medium">
          {formatCurrency(row.original.amount, 'MAD')}
        </div>
      ),
    },
    {
      accessorKey: "paymentMethod",
      header: "Méthode",
    },
    {
      accessorKey: "status",
      header: "Statut",
      cell: ({ row }) => (
        <Badge variant={row.getValue("status") === 'complete' ? 'default' : 'outline'} className={cn(
            row.getValue("status") === 'complete' && "bg-green-100 text-green-800",
            row.getValue("status") === 'en_attente' && "bg-yellow-100 text-yellow-800"
        )}>
          {row.getValue("status") === 'complete' ? "Complété" : "En attente"}
        </Badge>
      ),
    },
  ];

export default function PaymentTable({ payments }: { payments: Payment[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data: payments,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });

  return (
    <div className="w-full">
        <div className="flex items-center py-4 gap-2">
            <Input
            placeholder="Filtrer par client..."
            value={(table.getColumn("clientName")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
                table.getColumn("clientName")?.setFilterValue(event.target.value)
            }
            className="max-w-sm"
            />
        </div>
        <div className="rounded-md border bg-card">
        <Table>
            <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                    return (
                    <TableHead key={header.id}>
                        {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                            )}
                    </TableHead>
                    );
                })}
                </TableRow>
            ))}
            </TableHeader>
            <TableBody>
            {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                >
                    {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                        {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                        )}
                    </TableCell>
                    ))}
                </TableRow>
                ))
            ) : (
                <TableRow>
                <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                >
                    Aucun paiement trouvé.
                </TableCell>
                </TableRow>
            )}
            </TableBody>
        </Table>
        </div>
        <div className="flex items-center justify-end space-x-2 py-4">
        <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
        >
            Précédent
        </Button>
        <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
        >
            Suivant
        </Button>
        </div>
    </div>
  );
}
