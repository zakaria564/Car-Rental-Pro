
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
import { MoreHorizontal, Trash2, FileText, Printer } from "lucide-react";
import { format, differenceInCalendarDays, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Payment, Rental } from "@/lib/definitions";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useFirebase } from "@/firebase";
import { deleteDoc, doc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Invoice } from "../payments/invoice";

const getSafeDate = (date: any): Date | null => {
    if (!date) return null;
    if (date.toDate) return date.toDate();
    if (date instanceof Date) return date;
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
};

const calculateTotal = (rental: Rental): number => {
    const from = getSafeDate(rental.location.dateDebut);
    const to = getSafeDate(rental.location.dateFin);
    const pricePerDay = rental.location.prixParJour || 0;

    if (from && to && pricePerDay > 0) {
        if (startOfDay(from).getTime() === startOfDay(to).getTime()) {
            return pricePerDay;
        }
        const daysDiff = differenceInCalendarDays(to, from) || 1;
        return daysDiff * pricePerDay;
    }
    if (typeof rental.location.montantTotal === 'number' && !isNaN(rental.location.montantTotal) && rental.location.montantTotal > 0) {
      return rental.location.montantTotal;
    }
    if (rental.location.nbrJours && pricePerDay > 0) {
      return rental.location.nbrJours * pricePerDay;
    }
    return 0;
};


export default function ArchivedPaymentsTable({ payments, rentals }: { payments: Payment[], rentals: Rental[] }) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [paymentToDelete, setPaymentToDelete] = React.useState<Payment | null>(null);
  
  const [statementRental, setStatementRental] = React.useState<Rental | null>(null);
  const [isStatementOpen, setIsStatementOpen] = React.useState(false);

  const handleDeleteArchivedPayment = async (paymentId: string) => {
    if (!firestore) return;
    const paymentDocRef = doc(firestore, 'archived_payments', paymentId);
    
    try {
        await deleteDoc(paymentDocRef);
        toast({
            title: "Archive de paiement supprimée",
            description: "Le paiement a été supprimé des archives.",
        });
    } catch(serverError) {
        const permissionError = new FirestorePermissionError({
            path: paymentDocRef.path,
            operation: 'delete'
        }, serverError as Error);
        errorEmitter.emit('permission-error', permissionError);
        toast({
            variant: "destructive",
            title: "Erreur de suppression",
            description: "Vous n'avez pas la permission de supprimer cette archive.",
        });
    } finally {
        setPaymentToDelete(null);
    }
  };

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

  const columns: ColumnDef<Payment>[] = [
    {
      accessorKey: "paymentDate",
      header: "Date du paiement",
      cell: ({ row }) => {
        const date = row.original.paymentDate?.toDate ? row.original.paymentDate.toDate() : null;
        return date ? format(date, "dd/MM/yyyy", { locale: fr }) : "N/A";
      },
    },
    {
      accessorKey: "contractNumber",
      header: "Contrat N°",
    },
    {
      accessorKey: "clientName",
      header: "Client",
    },
    {
      accessorKey: "amount",
      header: () => <div className="text-right">Montant</div>,
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("amount"));
        return <div className="text-right font-medium">{formatCurrency(amount, 'MAD')}</div>;
      },
    },
    {
      accessorKey: "paymentMethod",
      header: "Méthode",
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const payment = row.original;
        const handleViewStatement = () => {
            const rental = rentals.find(r => r.contractNumber === payment.contractNumber);
            if (rental) {
                setStatementRental(rental);
                setIsStatementOpen(true);
            } else {
                toast({
                    variant: "destructive",
                    title: "Contrat non trouvé",
                    description: "Le contrat archivé correspondant à ce paiement n'a pas été trouvé.",
                });
            }
        };

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
               <DropdownMenuItem onSelect={handleViewStatement}>
                  <FileText className="mr-2 h-4 w-4" />
                  Voir le relevé
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                onSelect={() => setPaymentToDelete(payment)}
              >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

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
    <>
      <div className="w-full">
        <div className="flex items-center py-4 gap-2">
          <Input
            placeholder="Filtrer par N° de contrat..."
            value={(table.getColumn("contractNumber")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("contractNumber")?.setFilterValue(event.target.value)
            }
            className="max-w-sm"
          />
        </div>
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    Aucun paiement archivé.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end space-x-2 py-4">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Précédent</Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Suivant</Button>
        </div>
      </div>
      
       <Dialog open={isStatementOpen} onOpenChange={(open) => {
            setIsStatementOpen(open);
            if (!open) setStatementRental(null);
        }}>
          {statementRental && (
             <>
                <div className="hidden">
                    <Invoice 
                        rental={statementRental} 
                        payments={payments.filter(p => p.contractNumber === statementRental.contractNumber)}
                        totalAmount={calculateTotal(statementRental)}
                    />
                </div>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Relevé de compte (Archive)</DialogTitle>
                        <DialogDescription>
                            Contrat {statementRental.contractNumber} pour {statementRental.locataire.nomPrenom}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Méthode</TableHead>
                                <TableHead className="text-right">Montant</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payments.filter(p => p.contractNumber === statementRental.contractNumber).length > 0 ? payments.filter(p => p.contractNumber === statementRental.contractNumber).map(p => (
                            <TableRow key={p.id}>
                                <TableCell>{p.paymentDate?.toDate ? format(p.paymentDate.toDate(), "dd/MM/yyyy", { locale: fr }) : 'N/A'}</TableCell>
                                <TableCell>{p.paymentMethod}</TableCell>
                                <TableCell className="text-right">{formatCurrency(p.amount, 'MAD')}</TableCell>
                            </TableRow>
                            )) : (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">Aucun paiement archivé pour ce contrat.</TableCell>
                            </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handlePrintInvoice}>
                            <Printer className="mr-2 h-4 w-4"/>
                            Imprimer le relevé
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </>
          )}
        </Dialog>
      
      <AlertDialog open={!!paymentToDelete} onOpenChange={(open) => !open && setPaymentToDelete(null)}>
        {paymentToDelete && (
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer cette archive ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Le paiement archivé de {formatCurrency(paymentToDelete.amount, 'MAD')} pour le contrat {paymentToDelete.contractNumber} sera définitivement supprimé.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={() => handleDeleteArchivedPayment(paymentToDelete.id)} 
                        className="bg-destructive hover:bg-destructive/90"
                    >
                        Supprimer
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        )}
      </AlertDialog>
    </>
  );
}
