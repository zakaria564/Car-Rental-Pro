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
  GroupingState,
  getGroupedRowModel,
  getExpandedRowModel,
} from "@tanstack/react-table";
import { MoreHorizontal, Trash2, FileText, Printer, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
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
import { formatCurrency, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useFirebase } from "@/firebase";
import { deleteDoc, doc, runTransaction, getDocs, query, collection, where } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Invoice } from "../payments/invoice";
import { Badge } from "../ui/badge";


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


const StatementDialog = ({ rental, payments, onPrintClick }: {
  rental: Rental;
  payments: Payment[];
  onPrintClick: () => void;
}) => {
  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Relevé de compte (Corbeille)</DialogTitle>
        <DialogDescription>
          Contrat {rental.contractNumber} pour {rental.locataire.nomPrenom}
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
            {payments.length > 0 ? payments.map(p => (
              <TableRow key={p.id}>
                <TableCell>{p.paymentDate?.toDate ? format(p.paymentDate.toDate(), "dd/MM/yyyy", { locale: fr }) : 'N/A'}</TableCell>
                <TableCell>{p.paymentMethod}</TableCell>
                <TableCell className="text-right">{formatCurrency(p.amount, 'MAD')}</TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">Aucun paiement dans la corbeille pour ce contrat.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onPrintClick}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimer le relevé
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};


export default function ArchivedPaymentsTable({ payments, rentals }: { payments: Payment[], rentals: Rental[] }) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [grouping, setGrouping] = React.useState<GroupingState>(['client']);
  
  const [statementRental, setStatementRental] = React.useState<Rental | null>(null);
  const [isStatementOpen, setIsStatementOpen] = React.useState(false);

  const [rentalToDelete, setRentalToDelete] = React.useState<Rental | null>(null);
  
  const handleDeleteRentalAndPayments = async (rental: Rental) => {
    if (!firestore || !rental?.id) return;

    const rentalRef = doc(firestore, 'archived_rentals', rental.id);
    const paymentsQuery = query(collection(firestore, 'archived_payments'), where("contractNumber", "==", rental.contractNumber));

    try {
        await runTransaction(firestore, async (transaction) => {
            const paymentsSnapshot = await getDocs(paymentsQuery);
            paymentsSnapshot.forEach(doc => {
                transaction.delete(doc.ref);
            });
    
            transaction.delete(rentalRef);
        });

        toast({
            title: "Suppression définitive",
            description: "Le contrat et ses paiements associés ont été définitivement supprimés.",
        });

    } catch (serverError: any) {
        const permissionError = new FirestorePermissionError({
            path: rentalRef.path,
            operation: 'delete',
        }, serverError as Error);
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: "destructive",
          title: "Une erreur est survenue",
          description: serverError.message || "Impossible de supprimer le contrat.",
        });
    } finally {
        setRentalToDelete(null);
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

  const openStatement = (rental: Rental) => {
    setStatementRental(rental);
    setIsStatementOpen(true);
  }

  const columns: ColumnDef<Rental>[] = [
    {
      accessorKey: "contractNumber",
      header: "Contrat N°",
      cell: ({ row }) => row.getIsGrouped() ? null : row.getValue("contractNumber"),
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
      cell: ({ row }) => {
        if (row.getIsGrouped()) {
            return (
                <Button
                    variant="ghost"
                    onClick={() => row.toggleExpanded()}
                    className="w-full text-left justify-start pl-2"
                >
                    <span className="flex items-center gap-2 font-semibold">
                        {row.getIsExpanded() ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                        {row.getValue("client")} ({row.subRows.length})
                    </span>
                </Button>
            );
        }
        return null;
      },
    },
    {
      id: "montantTotal",
      header: () => <div className="text-right">Montant Total</div>,
      cell: ({ row }) => {
        if (row.getIsGrouped()) return null;
        const total = calculateTotal(row.original);
        return (
            <div className="text-right font-medium">
            {formatCurrency(total || 0, 'MAD')}
            </div>
        );
      },
    },
    {
      id: "montantPaye",
      header: () => <div className="text-right">Montant Payé</div>,
      cell: ({ row }) => {
          if (row.getIsGrouped()) return null;
          const relatedPayments = payments.filter(p => p.contractNumber === row.original.contractNumber);
          const totalPaid = relatedPayments.reduce((acc, p) => acc + p.amount, 0);
          return (
            <div className="text-right font-medium text-green-600">
              {formatCurrency(totalPaid, 'MAD')}
            </div>
          );
      }
    },
    {
      id: 'resteAPayer',
      header: () => <div className="text-right">Reste</div>,
      cell: ({ row }) => {
        if (row.getIsGrouped()) return null;
        const total = calculateTotal(row.original);
        const relatedPayments = payments.filter(p => p.contractNumber === row.original.contractNumber);
        const totalPaid = relatedPayments.reduce((acc, p) => acc + p.amount, 0);
        const reste = total - totalPaid;
        return (
            <div className={cn("text-right font-bold", reste > 0.01 ? "text-destructive" : "text-muted-foreground")}>
                {formatCurrency(reste, 'MAD')}
            </div>
        )
      }
    },
    {
      id: 'paymentStatus',
      header: "Statut Paiement",
      cell: ({ row }) => {
          if (row.getIsGrouped()) return null;
          const total = calculateTotal(row.original);
          const relatedPayments = payments.filter(p => p.contractNumber === row.original.contractNumber);
          const totalPaid = relatedPayments.reduce((acc, p) => acc + p.amount, 0);
        
          if (!total || total === 0) {
            return <Badge variant="outline">N/A</Badge>
          }
          
          const reste = total - totalPaid;
          
          let status: 'Payé' | 'Paiement Partiel' | 'Non Payé' = 'Non Payé';
          let variant: "default" | "destructive" | "secondary" = "destructive";

          if (reste <= 0.01) {
            status = 'Payé';
            variant = 'default';
          } else if (totalPaid > 0 && reste > 0.01) {
            status = 'Paiement Partiel';
            variant = 'secondary';
          }
          
          return (
            <Badge variant={variant} className={cn(
              status === 'Payé' && "bg-green-100 text-green-800 border-green-300",
              status === 'Paiement Partiel' && "bg-orange-100 text-orange-800 border-orange-300",
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
        if (row.getIsGrouped()) return null;
        const rental = row.original;
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
                <DropdownMenuItem onClick={() => openStatement(rental)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Voir le relevé
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                    onSelect={() => setRentalToDelete(rental)}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer définitivement
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
    onGroupingChange: setGrouping,
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    state: {
      sorting,
      columnFilters,
      grouping,
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
                    Aucun paiement dans la corbeille.
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
                <StatementDialog 
                    rental={statementRental} 
                    payments={payments.filter(p => p.contractNumber === statementRental.contractNumber)}
                    onPrintClick={handlePrintInvoice}
                />
            </>
          )}
        </Dialog>
      
      <AlertDialog open={!!rentalToDelete} onOpenChange={(open) => !open && setRentalToDelete(null)}>
        {rentalToDelete && (
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer définitivement ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Le contrat N° {rentalToDelete.contractNumber} et tous ses paiements associés seront définitivement supprimés.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={() => handleDeleteRentalAndPayments(rentalToDelete)} 
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
