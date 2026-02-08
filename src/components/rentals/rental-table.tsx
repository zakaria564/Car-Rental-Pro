

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
import { PlusCircle, MoreHorizontal, Printer, Pencil, CheckCircle, FileText, Triangle, Car, Gavel, ChevronDown, ChevronRight } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import type { Rental, Client, Car as CarType } from "@/lib/definitions";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import RentalForm from "./rental-form";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription as DialogDesc, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { query, where, runTransaction, doc, getDoc, collection, getDocs } from "firebase/firestore";
import { useFirebase } from "@/firebase";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { RentalDetails } from "./rental-contract-views";
import { ScrollArea } from "../ui/scroll-area";


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
  const [grouping, setGrouping] = React.useState<GroupingState>(['client']);
  const [formMode, setFormMode] = React.useState<'new' | 'edit' | 'check-in'>('new');

  // State for the modals
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [isAlertOpen, setIsAlertOpen] = React.useState(false);
  
  // Unified state for the rental being acted upon
  const [rentalForModal, setRentalForModal] = React.useState<Rental | null>(null);

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

    const styles = `
      @import url('https://rsms.me/inter/inter.css');
      body { font-family: 'Inter', sans-serif; }
      .no-print { display: none !important; }
      .printable-contract-body {
          border: none !important;
          box-shadow: none !important;
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
    
    // Link to external stylesheets from the main document
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
      setTimeout(function() { // Timeout to ensure styles are loaded
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
    
    try {
        await runTransaction(firestore, async (transaction) => {
            const carRef = doc(firestore, 'cars', rental.vehicule.carId);
            
            // First check if car document exists before trying to update it
            const carDoc = await transaction.get(carRef);

            // Delete associated payments
            const paymentsSnapshot = await getDocs(paymentsQuery);
            paymentsSnapshot.forEach(paymentDoc => {
                transaction.delete(paymentDoc.ref);
            });
    
            // Delete the rental document
            transaction.delete(rentalDocRef);
    
            // If the car exists, update its availability
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
    if (isDashboard) {
      return [
        {
          accessorKey: "vehicule.marque",
          header: "Voiture",
        },
        {
          accessorKey: "locataire.nomPrenom",
          header: "Client",
        },
        {
          accessorKey: "vehicule.immatriculation",
          header: "Immatriculation",
        },
        {
          accessorKey: "location.dateDebut",
          header: "Date départ",
          cell: ({ row }) => {
            const date = row.original.location.dateDebut?.toDate ? row.original.location.dateDebut.toDate() : null;
            return date ? format(date, "dd/MM/yyyy", { locale: fr }) : "N/A";
          },
        },
        {
          accessorKey: "location.dateFin",
          header: "Date de retour",
          cell: ({ row }) => {
            const date = row.original.location.dateFin?.toDate ? row.original.location.dateFin.toDate() : null;
            return date ? format(date, "dd/MM/yyyy", { locale: fr }) : "Date invalide";
          },
        },
        {
          accessorKey: "statut",
          header: "Statut",
          cell: ({ cell }) => {
            const status = cell.getValue() as string;
            return (
              <Badge
                variant={"outline"}
                className={cn(
                  status === "en_cours"
                    ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                    : "bg-green-100 text-green-800 border-green-200"
                )}
              >
                {status === "en_cours" ? "En cours" : "Terminée"}
              </Badge>
            );
          },
        },
      ];
    }
    
    return [
    {
      accessorKey: "contractNumber",
      header: "Contrat N°",
      cell: ({ row, cell }) => (row.getIsGrouped() ? null : cell.getValue()),
    },
    {
      accessorKey: "vehicule.marque",
      header: "Voiture",
      cell: ({ row, cell }) => (row.getIsGrouped() ? null : cell.renderValue()),
    },
    {
        accessorKey: "vehicule.immatriculation",
        header: "Immatriculation",
        cell: ({ row, cell }) => (row.getIsGrouped() ? null : cell.renderValue()),
    },
    {
      id: "client",
      accessorFn: (row) => row.locataire.nomPrenom,
      header: "Client",
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
                        {row.getValue("client")} ({row.subRows.length} contrats)
                    </span>
                </Button>
            );
        }
        return <div className="pl-4">{row.getValue("client")}</div>;
      },
    },
    {
      accessorKey: "location.dateDebut",
      header: "Date départ",
      cell: ({ row }) => {
        if (row.getIsGrouped()) return null;
        const date = row.original.location.dateDebut?.toDate ? row.original.location.dateDebut.toDate() : null;
        return date ? format(date, "dd/MM/yyyy", { locale: fr }) : "N/A";
      },
    },
    {
      accessorKey: "location.dateFin",
      header: "Date de retour",
      cell: ({ row }) => {
          if (row.getIsGrouped()) return null;
          const date = row.original.location.dateFin?.toDate ? row.original.location.dateFin.toDate() : null;
          return date ? format(date, "dd/MM/yyyy", { locale: fr }) : "Date invalide";
      }
    },
    {
      accessorKey: "statut",
      header: "Statut",
      cell: ({ row, cell }) => {
        if (row.getIsGrouped()) return null;
        const status = cell.getValue() as string;
        return (
            <Badge
                variant={"outline"}
                className={cn(
                  status === "en_cours"
                    ? "bg-yellow-100 text-yellow-800 border-yellow-200"
                    : "bg-green-100 text-green-800 border-green-200"
                )}
              >
                {status === "en_cours" ? "En cours" : "Terminée"}
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
              <DropdownMenuItem onSelect={() => {
                setRentalForModal(rental);
                setIsDetailsOpen(true);
              }}>
                <FileText className="mr-2 h-4 w-4"/>
                Voir les détails
              </DropdownMenuItem>
              
              {rental.statut === 'en_cours' && (
                  <>
                    <DropdownMenuItem onSelect={() => {
                        setRentalForModal(rental);
                        setFormMode('edit');
                        setIsSheetOpen(true);
                    }}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Modifier/Prolonger
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => {
                        setRentalForModal(rental);
                        setFormMode('check-in');
                        setIsSheetOpen(true);
                    }}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Réceptionner
                    </DropdownMenuItem>
                  </>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem 
                className="text-destructive focus:text-destructive focus:bg-destructive/10" 
                onSelect={() => {
                    setRentalForModal(rental);
                    setIsAlertOpen(true);
                }}
              >
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
  }, [isDashboard, setFormMode, setIsAlertOpen, setIsDetailsOpen, setIsSheetOpen, setRentalForModal, firestore, toast]);


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
            pageSize: isDashboard ? 5 : 10,
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
    if (formMode === 'edit') return "Modifier le contrat de location";
    if (formMode === 'check-in') return "Réceptionner le Véhicule";
    return "";
  };


  if (isDashboard) {
    // Simplified rendering for dashboard view
    return (
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
                  <TableCell colSpan={columns.length} className="h-24 text-center">Aucune location récente.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
       </div>
    );
  }

  // Full table with dialogs for the main rentals page
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
           <Button className="ml-auto bg-primary hover:bg-primary/90" onClick={() => {
              setRentalForModal(null);
              setFormMode('new');
              setIsSheetOpen(true);
            }}>
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter contrat
            </Button>
        </div>
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
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
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
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

      {/* --- Modals Section --- */}

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
              {rentalForModal && (
                <SheetDescription>
                    {rentalForModal.vehicule.marque} ({rentalForModal.vehicule.immatriculation})
                </SheetDescription>
              )}
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
                    <DialogTitle>Détails du contrat de location #{rentalForModal.contractNumber}</DialogTitle>
                    <DialogDesc>
                      Créé le {rentalForModal.createdAt?.toDate ? format(rentalForModal.createdAt.toDate(), "dd LLL, y 'à' HH:mm", { locale: fr }) : 'N/A'}
                    </DialogDesc>
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
                    <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Le contrat de location sera définitivement supprimé.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeleteRental(rentalForModal!)} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        )}
      </AlertDialog>
    </>
  );
}

    

    

    

