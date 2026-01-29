
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
import { ArrowUpDown, MoreHorizontal, Printer, FileText, DollarSign, History } from "lucide-react";
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
import type { Payment, Rental } from "@/lib/definitions";
import { formatCurrency, cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Invoice } from "./invoice";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

// New component for the payment history dialog
const PaymentHistoryDialog = ({ rental, payments, onPrintInvoice }: {
  rental: Rental;
  payments: Payment[];
  onPrintInvoice: (payment: Payment) => void;
}) => {
  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Historique des paiements</DialogTitle>
        <DialogDescription>
          Contrat {rental.id.substring(0,8).toUpperCase()} pour {rental.locataire.nomPrenom}
        </DialogDescription>
      </DialogHeader>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Méthode</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length > 0 ? payments.map(p => (
              <TableRow key={p.id}>
                <TableCell>{p.paymentDate?.toDate ? format(p.paymentDate.toDate(), "dd/MM/yyyy", { locale: fr }) : 'N/A'}</TableCell>
                <TableCell>{p.paymentMethod}</TableCell>
                <TableCell className="text-right">{formatCurrency(p.amount, 'MAD')}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => onPrintInvoice(p)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Facture
                  </Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">Aucun paiement enregistré pour ce contrat.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </DialogContent>
  )
};

export default function PaymentTable({ rentals, payments, onAddPaymentForRental }: { 
  rentals: Rental[], 
  payments: Payment[], 
  onAddPaymentForRental: (rentalId: string) => void 
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  
  const [selectedPaymentForInvoice, setSelectedPaymentForInvoice] = React.useState<Payment | null>(null);
  const [isInvoiceOpen, setIsInvoiceOpen] = React.useState(false);
  const [selectedRentalForHistory, setSelectedRentalForHistory] = React.useState<Rental | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
  const { toast } = useToast();

  const handlePrintInvoice = () => {
    const printContent = document.getElementById('printable-invoice');
    if (!printContent) return;

    const printWindow = window.open('', '', 'fullscreen=yes');
    if (!printWindow) {
      toast({
        variant: "destructive",
        title: "Erreur d'impression",
        description: "Veuillez autoriser les pop-ups pour imprimer.",
      });
      return;
    }
    
    const styles = `
      body { 
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
       }
      .no-print { display: none !important; }
       @page {
        size: A4;
        margin: 15mm;
      }
    `;

    printWindow.document.write('<html><head><title>Facture</title>');
    
    Array.from(document.styleSheets).forEach(sheet => {
        if (sheet.href) {
            printWindow.document.write(`<link rel="stylesheet" href="${sheet.href}">`);
        }
    });

    printWindow.document.write(`<style>${styles}</style>`);
    printWindow.document.write('</head><body>');
    printWindow.document.write(printContent.innerHTML);
    printWindow.document.write('</body></html>');
    
    printWindow.document.close();
    
    printWindow.onload = function() {
      setTimeout(function() {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 500);
    };
  };
  
  const openInvoice = (payment: Payment) => {
    setSelectedPaymentForInvoice(payment);
    setIsInvoiceOpen(true);
  }
  
  const openHistory = (rental: Rental) => {
    setSelectedRentalForHistory(rental);
    setIsHistoryOpen(true);
  }

  const columns: ColumnDef<Rental>[] = [
    {
      accessorKey: "id",
      header: "Contrat ID",
      cell: ({ row }) => <div className="font-mono text-xs">{row.original.id?.substring(0, 8).toUpperCase()}</div>,
    },
    {
      id: "client",
      accessorFn: (row) => row.locataire.nomPrenom,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Client
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: (info) => <div className="font-medium">{info.getValue() as string}</div>,
    },
    {
        accessorKey: "vehicule.marque",
        header: "Voiture",
    },
    {
      accessorKey: "location.montantTotal",
      header: () => <div className="text-right">Montant Total</div>,
      cell: ({ row }) => (
        <div className="text-right font-medium">
          {formatCurrency(row.original.location.montantTotal, 'MAD')}
        </div>
      ),
    },
    {
      accessorKey: "location.montantPaye",
      header: () => <div className="text-right">Montant Payé</div>,
      cell: ({ row }) => (
        <div className="text-right font-medium text-green-600">
          {formatCurrency(row.original.location.montantPaye || 0, 'MAD')}
        </div>
      ),
    },
    {
      id: 'resteAPayer',
      header: () => <div className="text-right">Reste à Payer</div>,
      cell: ({ row }) => {
        const reste = row.original.location.montantTotal - (row.original.location.montantPaye || 0);
        return (
            <div className={cn("text-right font-bold", reste > 0 ? "text-destructive" : "text-muted-foreground")}>
                {formatCurrency(reste, 'MAD')}
            </div>
        )
      }
    },
    {
        id: 'paymentStatus',
        header: "Statut Paiement",
        cell: ({ row }) => {
          const total = row.original.location.montantTotal;
          const paye = row.original.location.montantPaye || 0;
          const reste = total - paye;
          
          let status: 'Payé' | 'Paiement Partiel' | 'Non Payé' | 'Avance' = 'Non Payé';
          let variant: "default" | "destructive" | "outline" | "secondary" = "destructive";

          if (reste <= 0 && total > 0) {
            status = 'Payé';
            variant = 'default';
          } else if (paye > 0 && reste > 0) {
            status = 'Paiement Partiel';
            variant = 'secondary';
          }
          
          return (
            <Badge variant={variant} className={cn(
              status === 'Payé' && "bg-green-100 text-green-800 border-green-300",
              status === 'Paiement Partiel' && "bg-yellow-100 text-yellow-800 border-yellow-300",
              status === 'Non Payé' && "bg-red-100 text-red-800 border-red-300"
            )}>
              {status}
            </Badge>
          );
        },
      },
     {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const rental = row.original;
        const reste = rental.location.montantTotal - (rental.location.montantPaye || 0);
        return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Ouvrir le menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                {reste > 0 && 
                  <DropdownMenuItem onClick={() => onAddPaymentForRental(rental.id)}>
                    <DollarSign className="mr-2 h-4 w-4" />
                    <span>Encaisser un paiement</span>
                  </DropdownMenuItem>
                }
                <DropdownMenuItem onClick={() => openHistory(rental)}>
                  <History className="mr-2 h-4 w-4" />
                  Historique des paiements
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: rentals,
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
    <>
        <div className="w-full">
            <div className="flex items-center py-4 gap-2">
                <Input
                placeholder="Filtrer par client..."
                value={(table.getColumn("client")?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                    table.getColumn("client")?.setFilterValue(event.target.value)
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
                        Aucun contrat trouvé.
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
        
        <Dialog open={isHistoryOpen} onOpenChange={(open) => {
            setIsHistoryOpen(open);
            if (!open) setSelectedRentalForHistory(null);
        }}>
          {selectedRentalForHistory && (
            <PaymentHistoryDialog 
              rental={selectedRentalForHistory} 
              payments={payments.filter(p => p.rentalId === selectedRentalForHistory.id)}
              onPrintInvoice={openInvoice}
            />
          )}
        </Dialog>
        
        <Dialog open={isInvoiceOpen} onOpenChange={(open) => {
            setIsInvoiceOpen(open);
            if (!open) setSelectedPaymentForInvoice(null);
            }}>
            {selectedPaymentForInvoice && (
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader className="no-print">
                        <DialogTitle>Facture N° {selectedPaymentForInvoice.id?.substring(0,8).toUpperCase()}</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-[75vh]">
                      <Invoice payment={selectedPaymentForInvoice} />
                    </ScrollArea>
                    <DialogFooter className="no-print">
                    <Button variant="outline" onClick={handlePrintInvoice}>
                        <Printer className="mr-2 h-4 w-4"/>
                        Imprimer la facture
                    </Button>
                    </DialogFooter>
                </DialogContent>
            )}
        </Dialog>
    </>
  );
}
