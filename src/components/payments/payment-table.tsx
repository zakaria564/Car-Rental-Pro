
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
import { ArrowUpDown, MoreHorizontal, Printer, FileText, DollarSign, Trash2, ChevronRight, ChevronDown } from "lucide-react";
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
import { formatCurrency, cn, getSafeDate, calculateTotalRentalAmount } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Invoice } from "./invoice";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/firebase";
import { doc, runTransaction, query, where, getDocs, collection } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

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
              <TableHead>Date et Heure</TableHead>
              <TableHead>Méthode</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length > 0 ? payments.map(p => (
              <TableRow key={p.id}>
                <TableCell>{getSafeDate(p.paymentDate) ? format(getSafeDate(p.paymentDate)!, "dd/MM/yyyy HH:mm", { locale: fr }) : 'N/A'}</TableCell>
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
  const [grouping, setGrouping] = React.useState<GroupingState>(['client']);
  
  const [statementRental, setStatementRental] = React.useState<Rental | null>(null);
  const [isStatementOpen, setIsStatementOpen] = React.useState(false);

  const [paymentToDelete, setPaymentToDelete] = React.useState<Payment | null>(null);
  const [rentalToDelete, setRentalToDelete] = React.useState<Rental | null>(null);
  const { toast } = useToast();
  const { firestore } = useFirebase();

  const handleDeletePayment = async (paymentToDel: Payment) => {
    if (!firestore || !paymentToDel) return;

    const paymentRef = doc(firestore, "payments", paymentToDel.id);
    const rentalRef = doc(firestore, "rentals", paymentToDel.rentalId);

    try {
        await runTransaction(firestore, async (transaction) => {
            const rentalDoc = await transaction.get(rentalRef);
            if (!rentalDoc.exists()) {
                throw new Error("Contrat de location introuvable.");
            }

            const currentRentalData = rentalDoc.data() as Rental;
            const currentPaidAmount = currentRentalData.location.montantPaye || 0;
            const newPaidAmount = Math.max(0, currentPaidAmount - paymentToDel.amount);

            transaction.delete(paymentRef);
            transaction.update(rentalRef, { 'location.montantPaye': newPaidAmount });
        });

        toast({
          title: "Paiement supprimé",
          description: `Le paiement de ${formatCurrency(paymentToDel.amount, 'MAD')} a été annulé.`,
        });

    } catch (error: any) {
        const permissionError = new FirestorePermissionError({
            path: paymentRef.path,
            operation: 'delete',
        }, error);
        errorEmitter.emit('permission-error', permissionError);

        toast({
          variant: "destructive",
          title: "Une erreur est survenue",
          description: error.message || "Impossible de supprimer le paiement.",
        });
    } finally {
        setPaymentToDelete(null);
    }
  };

  const handleDeleteRentalAndPayments = async (rentalToDel: Rental) => {
    if (!firestore || !rentalToDel?.id) return;

    const rentalRef = doc(firestore, 'rentals', rentalToDel.id);
    const paymentsQuery = query(collection(firestore, 'payments'), where("rentalId", "==", rentalToDel.id));

    try {
        await runTransaction(firestore, async (transaction) => {
            const paymentsSnapshot = await getDocs(paymentsQuery);
            paymentsSnapshot.forEach(docSnap => {
                transaction.delete(docSnap.ref);
            });
    
            transaction.delete(rentalRef);
    
            const carRef = doc(firestore, 'cars', rentalToDel.vehicule.carId);
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
            operation: 'delete'
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
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .no-print { display: none !important; }
      @page { size: A4; margin: 15mm; }
    `;

    printWindow.document.write('<html><head><title>Facture</title>');
    Array.from(document.styleSheets).forEach(sheet => {
        if (sheet.href) printWindow.document.write(`<link rel="stylesheet" href="${sheet.href}">`);
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
      cell: ({ row, getValue }) => {
        if (row.getIsGrouped()) {
            return (
                <Button
                    variant="ghost"
                    onClick={() => row.toggleExpanded()}
                    className="w-full text-left justify-start pl-2 hover:bg-muted/50 group"
                >
                    <span className="flex items-center gap-2 font-bold text-base">
                        {row.getIsExpanded() ? (
                            <ChevronDown className="h-5 w-5" />
                        ) : (
                            <ChevronRight className="h-5 w-5" />
                        )}
                        {getValue() as string}
                        <Badge variant="outline" className="ml-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            {row.subRows.length} contrat(s)
                        </Badge>
                    </span>
                </Button>
            );
        }
        return (
          <div className="pl-10 text-muted-foreground italic text-xs flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-muted-foreground opacity-50" />
            {getValue() as string}
          </div>
        );
      },
    },
    {
      accessorKey: "contractNumber",
      header: "Contrat N°",
      cell: ({ row }) => {
        if (row.getIsGrouped()) {
            const latest = row.subRows[0]?.original;
            return latest ? <span className="font-mono text-[10px] text-muted-foreground bg-muted p-1 rounded">Dernier: {latest.contractNumber}</span> : null;
        }
        return <span className="font-mono font-medium">{row.original.contractNumber}</span>;
      },
    },
    {
        accessorKey: "vehicule.marque",
        header: "Voiture",
        cell: ({ row }) => {
            if (row.getIsGrouped()) {
                const latest = row.subRows[0]?.original;
                return latest ? <span className="text-xs text-muted-foreground">{latest.vehicule.marque}</span> : null;
            }
            return <span className="text-sm">{row.original.vehicule.marque}</span>;
        },
    },
    {
        accessorKey: "vehicule.immatriculation",
        header: "Immatriculation",
        cell: ({ row }) => {
            if (row.getIsGrouped()) {
                const latest = row.subRows[0]?.original;
                return latest ? <Badge variant="outline" className="font-mono text-[9px] opacity-70">{latest.vehicule.immatriculation}</Badge> : null;
            }
            return <Badge variant="secondary" className="font-mono text-[10px]">{row.original.vehicule.immatriculation}</Badge>;
        },
    },
    {
      id: "montantTotal",
      header: () => <div className="text-right">Montant Total</div>,
      cell: ({ row }) => {
        const rental = row.getIsGrouped() ? row.subRows[0]?.original : row.original;
        const total = rental ? calculateTotalRentalAmount(rental) : 0;
        return (
            <div className={cn("text-right font-medium", row.getIsGrouped() && "text-foreground/80")}>
            {formatCurrency(total || 0, 'MAD')}
            </div>
        );
      },
    },
    {
      accessorKey: "location.montantPaye",
      header: () => <div className="text-right">Montant Payé</div>,
      cell: ({ row }) => {
        const rental = row.getIsGrouped() ? row.subRows[0]?.original : row.original;
        const paid = rental?.location.montantPaye || 0;
        return (
          <div className={cn("text-right font-medium text-green-600", row.getIsGrouped() && "opacity-80")}>
            {formatCurrency(paid || 0, 'MAD')}
          </div>
        )
      },
    },
    {
      id: 'resteAPayer',
      header: () => <div className="text-right">Reste à Payer</div>,
      cell: ({ row }) => {
        const rental = row.getIsGrouped() ? row.subRows[0]?.original : row.original;
        const total = rental ? calculateTotalRentalAmount(rental) : 0;
        const paid = rental?.location.montantPaye || 0;
        const reste = total - paid;
        
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
          const rental = row.getIsGrouped() ? row.subRows[0]?.original : row.original;
          if (!rental) return <Badge variant="outline">N/A</Badge>;

          const total = calculateTotalRentalAmount(rental);
          const paye = rental.location.montantPaye || 0;

          if (!total || total === 0) {
            return <Badge variant="outline">N/A</Badge>
          }
          
          const reste = total - paye;
          
          let status: 'Payé' | 'Paiement Partiel' | 'Non Payé' = 'Non Payé';
          let variant: "default" | "destructive" | "secondary" = "destructive";

          if (reste <= 0.01) {
            status = 'Payé';
            variant = 'default';
          } else if (paye > 0 && reste > 0.01) {
            status = 'Paiement Partiel';
            variant = 'secondary';
          }
          
          return (
            <Badge variant={variant} className={cn(
              "font-bold",
              status === 'Payé' && "bg-green-100 text-green-800 border-green-300",
              status === 'Paiement Partiel' && "bg-orange-100 text-orange-800 border-orange-300",
              status === 'Non Payé' && "bg-red-600 text-white border-red-700",
              row.getIsGrouped() && "scale-90"
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
        const total = calculateTotalRentalAmount(rental);
        const reste = total - (rental.location.montantPaye || 0);
        
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
                {reste > 0.01 && 
                  <DropdownMenuItem onClick={() => onAddPaymentForRental(rental.id)} className="bg-primary/5 text-primary focus:bg-primary focus:text-primary-foreground">
                    <DollarSign className="mr-2 h-4 w-4" />
                    <span className="font-semibold">Encaisser un paiement</span>
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
    onGroupingChange: setGrouping,
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    state: {
      sorting,
      columnFilters,
      grouping,
    },
    initialState: {
      pagination: {
        pageSize: 20,
      }
    }
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
            <div className="rounded-md border bg-card shadow-sm">
            <Table>
                <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header) => {
                        return (
                        <TableHead key={header.id} className="font-bold text-foreground">
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
                    table.getRowModel().rows.map((row) => {
                        let hasUnpaid = false;
                        if (row.getIsGrouped()) {
                            // On signale toujours si le client a une dette sur N'IMPORTE QUEL contrat
                            const total = row.subRows.reduce((acc, subRow) => acc + calculateTotalRentalAmount(subRow.original), 0);
                            const paid = row.subRows.reduce((acc, subRow) => acc + (subRow.original.location.montantPaye || 0), 0);
                            hasUnpaid = (total - paid) > 0.01;
                        }

                        return (
                            <TableRow
                                key={row.id}
                                data-state={row.getIsSelected() && "selected"}
                                className={cn(
                                    row.getIsGrouped() ? "bg-muted/40" : "hover:bg-muted/20",
                                    hasUnpaid && row.getIsGrouped() && "border-l-4 border-l-red-600 bg-red-50/30"
                                )}
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
                        )
                    })
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
                <div className="hidden">
                    <Invoice 
                        rental={statementRental} 
                        payments={payments.filter(p => p.rentalId === statementRental.id)}
                        totalAmount={calculateTotalRentalAmount(statementRental)}
                    />
                </div>

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
                            Cette action est irréversible. Le paiement de {formatCurrency(paymentToDelete.amount, 'MAD')} du {getSafeDate(paymentToDelete.paymentDate) ? format(getSafeDate(paymentToDelete.paymentDate)!, "dd/MM/yyyy à HH:mm", { locale: fr }) : ''} sera supprimé.
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
                            Cette action est irréversible. Le contrat pour {rentalToDelete.locataire.nomPrenom} et TOUS ses paiements associés seront définitivement supprimés.
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
