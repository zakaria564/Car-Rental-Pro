"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  GroupingState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { PlusCircle, MoreHorizontal, Printer, Pencil, CheckCircle, FileText, DollarSign } from "lucide-react";
import { format, startOfDay, isToday } from "date-fns";
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
import { Badge } from "@/components/ui/badge";
import type { Rental, Client, Car as CarType } from "@/lib/definitions";
import { cn, formatCurrency, getRentalDate, calculateTotalRentalAmount } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import RentalForm from "./rental-form";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { query, where, runTransaction, doc, collection, getDocs } from "firebase/firestore";
import { useFirebase } from "@/firebase";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { RentalDetails } from "./rental-contract-views";
import { ScrollArea } from "../ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import PaymentForm from "../payments/payment-form";


type RentalTableProps = {
  rentals: Rental[];
  clients?: Client[];
  cars?: CarType[];
  isDashboard?: boolean;
};

export default function RentalTable({ rentals, clients = [], cars = [], isDashboard = false }: RentalTableProps) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [grouping, setGrouping] = React.useState<GroupingState>([]);
  const [formMode, setFormMode] = React.useState<'new' | 'edit' | 'check-in'>('new');

  // State for the modals
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [isAlertOpen, setIsAlertOpen] = React.useState(false);
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = React.useState(false);
  
  // Unified state for the rental being acted upon
  const [rentalForModal, setRentalForModal] = React.useState<Rental | null>(null);
  
  const openSheet = React.useCallback((mode: 'new' | 'edit' | 'check-in', rental: Rental | null) => {
    setRentalForModal(rental);
    setFormMode(mode);
    setIsSheetOpen(true);
  }, []);

  const openDetails = React.useCallback((rental: Rental) => {
      setRentalForModal(rental);
      setIsDetailsOpen(true);
  }, []);

  const openAlert = React.useCallback((rental: Rental) => {
      setRentalForModal(rental);
      setIsAlertOpen(true);
  }, []);
  
  const openPaymentSheet = React.useCallback((rental: Rental) => {
      setRentalForModal(rental);
      setIsPaymentSheetOpen(true);
  }, []);


  const handlePrint = () => {
    const printContent = document.getElementById('printable-contract');
    if (!printContent) return;

    const printWindow = window.open('', '', 'height=800,width=800');
    if (!printWindow) {
      toast({
        variant: "destructive",
        title: "Erreur d'impression",
        description: "Veuillez autoriser les pop-ups pour imprimer.",
      });
      return;
    }

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(tag => tag.outerHTML)
      .join('');

    const extraStyles = `
      @import url('https://rsms.me/inter/inter.css');
      body { 
        font-family: 'Inter', sans-serif; 
        background-color: white !important;
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important; 
      }
      * {
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important; 
      }
      img, svg {
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important; 
      }
      .no-print { display: none !important; }
      .printable-contract-body {
          border: none !important;
          box-shadow: none !important;
          width: 210mm;
          margin: 0 auto;
      }
      .signatures-section {
          page-break-before: auto;
          page-break-inside: avoid;
      }
      @page {
        size: A4;
        margin: 15mm;
      }
    `;

    printWindow.document.write('<html><head><title>Contrat de Location</title>');
    printWindow.document.write(styles);
    printWindow.document.write(`<style>${extraStyles}</style>`);
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


  const handleDeleteRental = async (rental: Rental) => {
    if (!firestore || !rental?.id) return;

    const rentalDocRef = doc(firestore, 'rentals', rental.id);
    const paymentsQuery = query(collection(firestore, 'payments'), where("rentalId", "==", rental.id));
    const carRef = doc(firestore, 'cars', rental.vehicule.carId);
    
    try {
        await runTransaction(firestore, async (transaction) => {
            const carDoc = await transaction.get(carRef);
            const paymentsSnapshot = await getDocs(paymentsQuery);

            paymentsSnapshot.forEach(paymentDoc => {
                transaction.delete(paymentDoc.ref);
            });
    
            transaction.delete(rentalDocRef);
    
            if (carDoc.exists()) {
                transaction.update(carRef, { disponibilite: 'disponible' });
            }
        });

        toast({
            title: "Contrat supprimé",
            description: "Le contrat et ses paiements associés ont été supprimés avec succès.",
        });
    } catch (serverError: any) {
        console.error("Erreur de transaction lors de la suppression:", serverError);
        const permissionError = new FirestorePermissionError({
            path: rentalDocRef.path,
            operation: 'delete'
        }, serverError);
        errorEmitter.emit('permission-error', permissionError);
        toast({
            variant: "destructive",
            title: "Erreur de suppression",
            description: serverError.message || "Impossible de supprimer ce contrat.",
        });
    }

    setIsAlertOpen(false);
  };
  
  const columns: ColumnDef<Rental>[] = React.useMemo(() => {
    const cols: ColumnDef<Rental>[] = [
    {
      accessorKey: "contractNumber",
      header: "Contrat N°",
      cell: ({ row }) => {
        return <span className="font-mono text-[12px]">{row.original.contractNumber}</span>;
      },
    },
    {
      accessorKey: "vehicule.marque",
      header: "Voiture",
      cell: ({ row }) => {
          return <span className="text-[12px]">{row.original.vehicule.marque}</span>;
      },
    },
    {
        accessorKey: "vehicule.immatriculation",
        header: "Immat.",
        cell: ({ row }) => {
            return <span className="font-mono text-[12px]">{row.original.vehicule.immatriculation}</span>;
        },
    },
    {
      id: "client",
      accessorFn: (row) => row.locataire.nomPrenom,
      header: "Client",
       cell: ({ row, getValue }) => {
        return (
          <div className={cn("font-medium text-[12px]", isDashboard && "truncate max-w-[100px]")}>
            {getValue() as string}
          </div>
        );
      },
    },
    {
      id: "dateDebut",
      header: isDashboard ? "Départ" : "Date départ",
      cell: ({ row }) => {
        const date = getRentalDate(row.original, 'dateDebut');
        return <span className="text-[12px]">{date ? format(date, isDashboard ? "dd/MM/yy" : "dd/MM/yyyy", { locale: fr }) : "N/A"}</span>;
      },
    },
    {
      id: "dateFin",
      header: isDashboard ? "Retour" : "Date de retour",
      cell: ({ row }) => {
          const date = getRentalDate(row.original, 'dateFin');
          if (!date) return <span className="text-[12px]">Date invalide</span>;
          
          const isReturnToday = isToday(date);
          const isOverdue = startOfDay(date).getTime() < startOfDay(new Date()).getTime() && row.original.statut === 'en_cours';

          return (
              <div className="flex items-center gap-1.5">
                  <span className={cn("text-[12px]", isOverdue && "text-destructive font-bold")}>
                    {format(date, isDashboard ? "dd/MM/yy" : "dd/MM/yyyy", { locale: fr })}
                  </span>
                  {(isReturnToday || isOverdue) && row.original.statut === 'en_cours' && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                    </span>
                  )}
              </div>
          );
      }
    },
    {
      accessorKey: "statut",
      header: "Statut",
      cell: ({ row }) => {
        const status = row.original.statut;
        return (
            <Badge
                variant={status === "en_cours" ? "secondary" : "default"}
                className={cn(
                  "text-[11px] w-[80px] flex justify-center",
                  status === "en_cours"
                    ? "bg-blue-600 text-white border-blue-700 hover:bg-blue-600"
                    : "bg-green-600 text-white border-green-700 hover:bg-green-600"
                )}
              >
                {status === "en_cours" ? "En cours" : "Terminée"}
              </Badge>
        );
      },
    },
    {
      id: "paymentStatus",
      header: "Paiement",
      cell: ({ row }) => {
        const rental = row.original;
        const total = calculateTotalRentalAmount(rental);
        const paid = rental.location.montantPaye || 0;
        const remaining = Math.max(0, total - paid);
        
        const badgeClass = cn("text-[11px] w-[80px] flex justify-center");

        if (rental.statut === 'terminee' && remaining > 0.01) {
          return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge variant="destructive" className={cn(badgeClass, "bg-red-600 text-white border-red-700")}>Non réglé</Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Reste à payer: {formatCurrency(remaining, 'MAD')}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
          );
        }
        
        if (paid > 0 && remaining > 0.01) {
           return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge variant="secondary" className={cn(badgeClass, "bg-orange-500 text-white border-orange-600 hover:bg-orange-500")}>
                            Partiel
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Reste à payer: {formatCurrency(remaining, 'MAD')}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
          );
        }
        
         if (paid === 0 && total > 0) {
           return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge variant="destructive" className={cn(badgeClass, "bg-red-600 text-white border-red-700 hover:bg-red-600")}>
                            Non payé
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Total à payer: {formatCurrency(total, 'MAD')}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
          );
        }

        if (remaining <= 0.01 && total > 0) {
            return (
                <Badge variant="default" className={cn(badgeClass, "bg-green-600 text-white border-green-700 hover:bg-green-600")}>
                    Payé
                </Badge>
            );
        }

        return <Badge variant="outline" className={badgeClass}>N/A</Badge>;
      },
    }
  ];

  if (!isDashboard) {
    cols.push({
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const rental = row.original;
        const total = calculateTotalRentalAmount(rental);
        const paid = rental.location.montantPaye || 0;
        const remaining = total - paid;

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
              <DropdownMenuItem onSelect={() => openDetails(rental)}>
                <FileText className="mr-2 h-4 w-4"/>
                Voir les détails
              </DropdownMenuItem>
              
              {remaining > 0.01 && (
                  <DropdownMenuItem onSelect={() => openPaymentSheet(rental)}>
                      <DollarSign className="mr-2 h-4 w-4" />
                      Encaisser un paiement
                  </DropdownMenuItem>
              )}

              {rental.statut === 'en_cours' && (
                  <>
                    <DropdownMenuItem onSelect={() => openSheet('edit', rental)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Modifier/Prolonger
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openSheet('check-in', rental)}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Réceptionner
                    </DropdownMenuItem>
                  </>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem 
                className="text-destructive focus:text-destructive focus:bg-destructive/10" 
                onSelect={() => openAlert(rental)}
              >
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    });
  }

  return cols;
  }, [isDashboard, openSheet, openDetails, openAlert, openPaymentSheet]);


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
    getExpandedRowModel: getExpandedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    initialState: {
        pagination: {
            pageSize: isDashboard ? 5 : 20,
        }
    },
    state: {
      sorting,
      columnFilters,
      grouping,
    },
  });
  
  const getSheetTitle = () => {
    if (formMode === 'new') return "Créer un nouveau contrat";
    if (formMode === 'edit') return "Modifier le contrat";
    if (formMode === 'check-in') return "Réceptionner le véhicule";
    return "Gestion du contrat";
  };


  if (isDashboard) {
    return (
       <div className="rounded-md border bg-card">
         <Table wrapperClassName="overflow-hidden">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="h-8 px-2 text-[12px] font-bold uppercase text-muted-foreground/70">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="border-b last:border-0">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-2 py-1.5 h-10 text-[12px]">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-xs text-muted-foreground">Aucune location en cours.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
       </div>
    );
  }

  return (
    <>
      <div className="w-full">
        <div className="flex items-center py-4 gap-2">
          <Input
            placeholder="Filtrer par numéro de contrat..."
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
           <Button className="ml-auto bg-primary hover:bg-primary/90" onClick={() => openSheet('new', null)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter contrat
            </Button>
        </div>
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="text-[12px] font-bold text-foreground">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
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
                      <TableCell key={cell.id} className="text-[12px]">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-[12px]">
                    Aucun résultat.
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

      <Sheet open={isSheetOpen} onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) {
            setRentalForModal(null);
            setFormMode('new');
          }
      }}>
        <SheetContent className="sm:max-w-[600px] flex flex-col">
            <SheetHeader>
              <SheetTitle>{getSheetTitle()}</SheetTitle>
              <SheetDescription>
                  Gérez les détails de la location et l'état du véhicule.
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-grow pr-6">
              <RentalForm 
                key={rentalForModal?.id || 'new-rental'}
                rental={rentalForModal} 
                clients={clients} 
                cars={cars} 
                rentals={rentals}
                mode={formMode}
                onFinished={() => setIsSheetOpen(false)} />
            </ScrollArea>
        </SheetContent>
      </Sheet>

      <Dialog open={isDetailsOpen} onOpenChange={(open) => {
          setIsDetailsOpen(open);
          if (!open) setRentalForModal(null);
        }}>
        {rentalForModal && (
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader className="no-print">
                    <DialogTitle>Détails du contrat #{rentalForModal.contractNumber}</DialogTitle>
                    <DialogDescription>
                      Consultez les informations de location et les inspections de départ/retour.
                    </DialogDescription>
                </DialogHeader>
                <RentalDetails rental={rentalForModal} />
                <DialogFooter className="no-print">
                  <Button variant="outline" onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4"/>
                    Imprimer le contrat
                  </Button>
                </DialogFooter>
            </DialogContent>
        )}
      </Dialog>
      
      <AlertDialog open={isAlertOpen} onOpenChange={(open) => {
          setIsAlertOpen(open);
          if (!open) setRentalForModal(null);
        }}>
        {rentalForModal && (
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer ce contrat ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Le contrat de location sera définitivement supprimé ainsi que ses paiements.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeleteRental(rentalForModal!)} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        )}
      </AlertDialog>

      <Sheet open={isPaymentSheetOpen} onOpenChange={(open) => {
          setIsPaymentSheetOpen(open);
          if (!open) {
            setRentalForModal(null);
          }
      }}>
        <SheetContent className="sm:max-w-md flex flex-col">
            <SheetHeader>
                <SheetTitle>Ajouter un paiement</SheetTitle>
                <SheetDescription>
                    Enregistrez un nouveau versement pour le contrat N° {rentalForModal?.contractNumber}
                </SheetDescription>
            </SheetHeader>
            <div className="flex-1 min-h-0">
                <PaymentForm 
                    payment={null} 
                    rentals={rentals} 
                    onFinished={() => setIsPaymentSheetOpen(false)}
                    preselectedRentalId={rentalForModal?.id}
                />
            </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
