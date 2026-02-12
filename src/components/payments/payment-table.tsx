

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
import { ArrowUpDown, MoreHorizontal, Printer, FileText, DollarSign, History, Trash2 } from "lucide-react";
import { format, differenceInCalendarDays, startOfDay } from "date-fns";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Invoice } from "./invoice";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/firebase";
import { doc, runTransaction, query, where, getDocs, collection, getDoc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";


const getSafeDate = (date: any): Date | null => {
    if (!date) return null;
    if (date.toDate) return date.toDate();
    if (date instanceof Date) return date;
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
};


const RentalStatementDialog = ({ rental, payments, onDeletePaymentClick, onPrintClick }: {
  rental: Rental;
  payments: Payment[];
  onDeletePaymentClick: (payment: Payment) => void;
  onPrintClick: () => void;
}) => {
  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Relevé de compte</DialogTitle>
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
                   <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Ouvrir le menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
                              onSelect={() => onDeletePaymentClick(p)}
                          >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer
                          </DropdownMenuItem>
                      </DropdownMenuContent>
                  </DropdownMenu>
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
       <DialogFooter>
        <Button variant="outline" onClick={onPrintClick}>
          <Printer className="mr-2 h-4 w-4"/>
          Imprimer le relevé
        </Button>
      </DialogFooter>
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
  
  const [statementRental, setStatementRental] = React.useState<Rental | null>(null);
  const [isStatementOpen, setIsStatementOpen] = React.useState(false);

  const [paymentToDelete, setPaymentToDelete] = React.useState<Payment | null>(null);
  const [rentalToDelete, setRentalToDelete] = React.useState<Rental | null>(null);
  const { toast } = useToast();
  const { firestore } = useFirebase();

  const calculateTotal = (rental: Rental): number => {
    const from = getSafeDate(rental.location.dateDebut);
    const to = getSafeDate(rental.location.dateFin);
    const pricePerDay = rental.location.prixParJour || 0;

    if (from && to && pricePerDay > 0) {
        const daysDiff = differenceInCalendarDays(startOfDay(to), startOfDay(from));
        const rentalDays = daysDiff === 0 ? 1 : daysDiff;
        return rentalDays * pricePerDay;
    }

    // Fallbacks
    if (typeof rental.location.montantTotal === 'number' && !isNaN(rental.location.montantTotal) && rental.location.montantTotal > 0) {
      return rental.location.montantTotal;
    }
    if (rental.location.nbrJours && pricePerDay > 0) {
      return rental.location.nbrJours * pricePerDay;
    }
    
    return 0;
  };

  const handleDeletePayment = async (paymentToDelete: Payment) => {
    if (!firestore || !paymentToDelete) return;

    const paymentRef = doc(firestore, "payments", paymentToDelete.id);
    const rentalRef = doc(firestore, "rentals", paymentToDelete.rentalId);

    try {
        await runTransaction(firestore, async (transaction) => {
            const rentalDoc = await transaction.get(rentalRef);
            if (!rentalDoc.exists()) {
                throw "Contrat de location introuvable.";
            }

            const currentRentalData = rentalDoc.data() as Rental;
            const currentPaidAmount = currentRentalData.location.montantPaye || 0;
            const newPaidAmount = currentPaidAmount - paymentToDelete.amount;

            transaction.delete(paymentRef);
            transaction.update(rentalRef, { 'location.montantPaye': newPaidAmount });
        });

        toast({
          title: "Paiement supprimé",
          description: `Le paiement de ${formatCurrency(paymentToDelete.amount, 'MAD')} a été annulé.`,
        });

    } catch (error: any) {
        console.error("Erreur de transaction lors de la suppression:", error);
        
        const permissionError = new FirestorePermissionError({
            path: paymentRef.path,
            operation: 'delete',
        }, error);
        errorEmitter.emit('permission-error', permissionError);

        toast({
          variant: "destructive",
          title: "Une erreur est survenue",
          description: error.message || "Impossible de supprimer le paiement. Vérifiez vos permissions et réessayez.",
        });
    } finally {
        setPaymentToDelete(null);
    }
  };

  const handleDeleteRentalAndPayments = async (rental: Rental) => {
    if (!firestore || !rental?.id) return;

    const rentalRef = doc(firestore, 'rentals', rental.id);
    const paymentsQuery = query(collection(firestore, 'payments'), where("rentalId", "==", rental.id));

    try {
        await runTransaction(firestore, async (transaction) => {
            const paymentsSnapshot = await getDocs(paymentsQuery);
            paymentsSnapshot.forEach(doc => {
                transaction.delete(doc.ref);
            });
    
            transaction.delete(rentalRef);
    
            // Safely update car status
            const carRef = doc(firestore, 'cars', rental.vehicule.carId);
            const carDoc = await transaction.get(carRef);
            if (carDoc.exists()) {
                transaction.update(carRef, { disponibilite: 'disponible' });
            }
        });

        toast({
            title: "Contrat supprimé",
            description: "Le contrat et tous ses paiements associés ont été supprimés.",
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
          description: serverError.message || "Impossible de supprimer le contrat et ses paiements.",
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
        accessorKey: "vehicule.immatriculation",
        header: "Immatriculation",
    },
    {
      id: "montantTotal",
      header: () => <div className="text-right">Montant Total</div>,
      cell: ({ row }) => {
        const total = calculateTotal(row.original);
        return (
            <div className="text-right font-medium">
            {formatCurrency(total || 0, 'MAD')}
            </div>
        );
      },
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
        const total = calculateTotal(row.original);
        const reste = (total || 0) - (row.original.location.montantPaye || 0);
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
          const total = calculateTotal(row.original);
          const paye = row.original.location.montantPaye || 0;

          if (!total || total === 0) {
            return <Badge variant="outline">N/A</Badge>
          }
          
          const reste = total - paye;
          
          let status: 'Payé' | 'Paiement Partiel' | 'Non Payé' = 'Non Payé';
          let variant: "default" | "destructive" | "secondary" = "destructive";

          if (reste <= 0) {
            status = 'Payé';
            variant = 'default';
          } else if (paye > 0 && reste > 0) {
            status = 'Paiement Partiel';
            variant = 'secondary';
          }
          
          return (
            <Badge variant={variant} className={cn(
              status === 'Payé' && "bg-green-500/20 text-green-800 border-green-300",
              status === 'Paiement Partiel' && "bg-orange-500/20 text-orange-800 border-orange-300",
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
        const total = calculateTotal(rental);
        const reste = (total || 0) - (rental.location.montantPaye || 0);
        
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
                    Supprimer le contrat
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
                placeholder="Filtrer par N° de contrat..."
                value={(table.getColumn("contractNumber")?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                    table.getColumn("contractNumber")?.setFilterValue(event.target.value)
                }
                className="max-w-sm"
                />
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
        
        <Dialog open={isStatementOpen} onOpenChange={(open) => {
            setIsStatementOpen(open);
            if (!open) setStatementRental(null);
        }}>
          {statementRental && (
             <>
                {/* This is the hidden printable component */}
                <div className="hidden">
                    <Invoice 
                        rental={statementRental} 
                        payments={payments.filter(p => p.rentalId === statementRental.id)}
                        totalAmount={calculateTotal(statementRental)}
                    />
                </div>

                {/* This is the visible dialog */}
                <RentalStatementDialog 
                    rental={statementRental} 
                    payments={payments.filter(p => p.rentalId === statementRental.id)}
                    onDeletePaymentClick={setPaymentToDelete}
                    onPrintClick={handlePrintInvoice}
                />
            </>
          )}
        </Dialog>

        <AlertDialog open={!!paymentToDelete} onOpenChange={(open) => !open && setPaymentToDelete(null)}>
            {paymentToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce paiement ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible. Le paiement de ${formatCurrency(paymentToDelete.amount, 'MAD')} du ${paymentToDelete.paymentDate?.toDate ? format(paymentToDelete.paymentDate.toDate(), "dd/MM/yyyy") : ''} sera supprimé.
                            Le montant sera déduit du total payé pour le contrat.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={() => handleDeletePayment(paymentToDelete)} 
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            )}
        </AlertDialog>

        <AlertDialog open={!!rentalToDelete} onOpenChange={(open) => !open && setRentalToDelete(null)}>
            {rentalToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce contrat ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible. Le contrat pour ${rentalToDelete.locataire.nomPrenom} et <strong>tous</strong> ses paiements associés seront définitivement supprimés.
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
