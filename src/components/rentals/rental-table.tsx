
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
import { PlusCircle, MoreHorizontal, Printer, Pencil, CheckCircle } from "lucide-react";
import { format } from "date-fns";
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
import type { Rental, Client, Car } from "@/lib/definitions";
import { formatCurrency } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import RentalForm from "./rental-form";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription as DialogDesc, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import Image from "next/image";
import { ScrollArea } from "../ui/scroll-area";
import { doc, deleteDoc, updateDoc, writeBatch } from "firebase/firestore";
import { useFirebase } from "@/firebase";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

type RentalTableProps = {
  rentals: Rental[];
  clients?: Client[];
  cars?: Car[];
  isDashboard?: boolean;
};

function RentalDetails({ rental }: { rental: Rental }) {
    const getSafeDate = (date: any): Date | undefined => {
        if (!date) return undefined;
        if (date instanceof Date) return date;
        if (date.toDate && typeof date.toDate === 'function') return date.toDate();
        const parsed = new Date(date);
        return isNaN(parsed.getTime()) ? undefined : parsed;
    };

    const safeLivraisonDate = getSafeDate(rental.livraison.dateHeure);
    const safeReceptionDate = getSafeDate(rental.reception?.dateHeure);
    const safeDebutDate = getSafeDate(rental.location.dateDebut);
    const safeFinDate = getSafeDate(rental.location.dateFin);
    const safeMiseEnCirculation = getSafeDate(rental.vehicule.dateMiseEnCirculation);

    return (
      <ScrollArea className="h-[70vh]">
        <div className="space-y-6 text-sm p-2" id="printable-contract">
            {/* Header */}
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold tracking-wider">CONTRAT DE LOCATION DE VÉHICULE</h2>
                <p className="text-muted-foreground">Contrat N°: {rental.id?.substring(0, 8).toUpperCase()}</p>
            </div>

            {/* Parties */}
            <div className="border p-4 rounded-md">
                <h3 className="font-bold text-base mb-2 underline">ENTRE LES SOUSSIGNÉS :</h3>
                <div className="grid grid-cols-2 gap-x-8">
                    <div>
                        <h4 className="font-semibold">Le Loueur :</h4>
                        <p>Location Auto Pro</p>
                        <p>Agdal, Rabat, Maroc</p>
                        <p>Tél: +212 537 00 00 00</p>
                    </div>
                    <div>
                        <h4 className="font-semibold">Le Locataire (Conducteur Principal) :</h4>
                        <p><strong>Nom:</strong> {rental.locataire.nomPrenom}</p>
                        <p><strong>CIN/Passeport:</strong> {rental.locataire.cin}</p>
                        <p><strong>Permis N°:</strong> {rental.locataire.permisNo}</p>
                        <p><strong>Téléphone:</strong> {rental.locataire.telephone}</p>
                    </div>
                </div>
            </div>

            {/* 2nd driver */}
            {rental.conducteur2 && (
              <div className="border p-4 rounded-md">
                  <h3 className="font-bold text-base mb-2 underline">DEUXIÈME CONDUCTEUR AUTORISÉ</h3>
                  <div className="grid grid-cols-2 gap-x-8">
                    <p><strong>Nom:</strong> {rental.conducteur2.nomPrenom}</p>
                    <p><strong>CIN/Passeport:</strong> {rental.conducteur2.cin}</p>
                    <p><strong>Permis N°:</strong> {rental.conducteur2.permisNo}</p>
                    {rental.conducteur2.telephone && <p><strong>Téléphone:</strong> {rental.conducteur2.telephone}</p>}
                  </div>
              </div>
            )}

            {/* Vehicle */}
            <div className="border p-4 rounded-md">
                <h3 className="font-bold text-base mb-2 underline">VÉHICULE LOUÉ</h3>
                 <div className="grid grid-cols-2 gap-x-8">
                    <div>
                        <p><strong>Marque/Modèle:</strong> {rental.vehicule.marque}</p>
                        <p><strong>Immatriculation:</strong> {rental.vehicule.immatriculation}</p>
                        <p><strong>Mise en circulation:</strong> {safeMiseEnCirculation ? format(safeMiseEnCirculation, "dd/MM/yyyy", { locale: fr }) : 'N/A'}</p>
                    </div>
                    <div>
                        <p><strong>Couleur:</strong> {rental.vehicule.couleur}</p>
                        <p><strong>Carburant:</strong> {rental.vehicule.carburantType}</p>
                        <p><strong>Puissance:</strong> {rental.vehicule.puissance} ch</p>
                        <p><strong>Transmission:</strong> {rental.vehicule.transmission}</p>
                    </div>
                </div>
            </div>

            {/* Rental Period & Financials */}
            <div className="border p-4 rounded-md">
                 <h3 className="font-bold text-base mb-2 underline">CONDITIONS DE LOCATION</h3>
                <div className="grid grid-cols-2 gap-x-8">
                    <div>
                        <p><strong>Début:</strong> {safeDebutDate ? format(safeDebutDate, "dd/MM/yyyy 'à' HH:mm", { locale: fr }) : 'N/A'}</p>
                        <p><strong>Fin Prévue:</strong> {safeFinDate ? format(safeFinDate, "dd/MM/yyyy 'à' HH:mm", { locale: fr }) : 'N/A'}</p>
                        <p><strong>Durée:</strong> {rental.location.nbrJours} jour(s)</p>
                    </div>
                     <div>
                        <p><strong>Prix/Jour:</strong> {formatCurrency(rental.location.prixParJour, 'MAD')}</p>
                        <p><strong>Montant Total:</strong> {formatCurrency(rental.location.montantAPayer, 'MAD')}</p>
                        {rental.statut !== 'terminee' && rental.location.depot && rental.location.depot > 0 && (
                            <p><strong>Dépôt de Garantie:</strong> {formatCurrency(rental.location.depot, 'MAD')}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Delivery / Return state */}
            <div className="border p-4 rounded-md">
                <h3 className="font-bold text-base mb-2 underline">ÉTAT DU VÉHICULE</h3>
                <div className="grid grid-cols-2 gap-x-8">
                    <div>
                        <h4 className="font-semibold">Livraison (Départ)</h4>
                        <p><strong>Date:</strong> {safeLivraisonDate ? format(safeLivraisonDate, "dd/MM/yyyy HH:mm", { locale: fr }) : 'N/A'}</p>
                        <p><strong>Kilométrage:</strong> {rental.livraison.kilometrage.toLocaleString()} km</p>
                        <p><strong>Niveau Carburant:</strong> {rental.livraison.carburantNiveau * 100}%</p>
                        {rental.livraison.dommages && rental.livraison.dommages.length > 0 && <p><strong>Dommages:</strong> {rental.livraison.dommages.join(', ')}</p>}
                        {rental.livraison.dommagesNotes && <p><strong>Notes:</strong> {rental.livraison.dommagesNotes}</p>}
                    </div>
                    <div>
                        <h4 className="font-semibold">Réception (Retour)</h4>
                        {rental.statut === 'terminee' && safeReceptionDate ? (
                          <>
                            <p><strong>Date:</strong> {format(safeReceptionDate, "dd/MM/yyyy HH:mm", { locale: fr })}</p>
                            <p><strong>Kilométrage:</strong> {rental.reception.kilometrage?.toLocaleString()} km</p>
                            <p><strong>Niveau Carburant:</strong> {rental.reception.carburantNiveau ? rental.reception.carburantNiveau * 100 + '%' : 'N/A'}</p>
                            {rental.reception.dommages && rental.reception.dommages.length > 0 && <p><strong>Dommages:</strong> {rental.reception.dommages.join(', ')}</p>}
                            {rental.reception.dommagesNotes && <p><strong>Notes:</strong> {rental.reception.dommagesNotes}</p>}
                          </>
                        ) : <p>Véhicule non retourné.</p>}
                    </div>
                </div>
            </div>

            {/* Signatures */}
            <div className="pt-16">
                <div className="grid grid-cols-2 gap-16">
                    <div className="text-center">
                        <p className="border-t pt-2">Signature du Loueur</p>
                        <p className="text-xs text-muted-foreground">(Précédée de la mention "Lu et approuvé")</p>
                    </div>
                     <div className="text-center">
                        <p className="border-t pt-2">Signature du Locataire</p>
                        <p className="text-xs text-muted-foreground">(Précédée de la mention "Lu et approuvé")</p>
                    </div>
                </div>
            </div>
        </div>
      </ScrollArea>
    );
}


export default function RentalTable({ rentals, clients = [], cars = [], isDashboard = false }: RentalTableProps) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
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
      body { 
        -webkit-print-color-adjust: exact;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
        line-height: 1.4;
        font-size: 9px; /* Reduced font size */
        margin: 0;
        padding: 0;
      }
      p { margin: 0.05rem 0; } /* Reduced paragraph margin */
      .space-y-6 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.5rem; } /* Reduced section spacing */
      .text-sm { font-size: 9px; line-height: 1.1; }
      .p-4 { padding: 0.4rem; } /* Reduced padding */
      .text-center { text-align: center; }
      .mb-8 { margin-bottom: 0.75rem; }
      .text-2xl { font-size: 1.1rem; line-height: 1.3rem; }
      .font-bold { font-weight: 700; }
      .tracking-wider { letter-spacing: 0.05em; }
      .text-muted-foreground { color: #64748b; }
      .border { border: 1px solid #e2e8f0; }
      .rounded-md { border-radius: 0.375rem; }
      .mb-2 { margin-bottom: 0.2rem; }
      .underline { text-decoration: underline; }
      .font-semibold { font-weight: 600; }
      .text-base { font-size: 10px; }
      .grid { display: grid; }
      .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .gap-x-8 { column-gap: 1rem; }
      .pt-16 { padding-top: 1rem; } /* Reduced signature padding */
      .gap-16 { gap: 1.5rem; }
      .border-t { border-top-width: 1px; }
      .pt-2 { padding-top: 0.25rem; }
      .text-xs { font-size: 8px; }
      strong { font-weight: 600; }
      @page {
        size: A4;
        margin: 10mm; /* Reduced page margins */
      }
      h1, h2, h3, h4, h5, h6, p, div {
        break-inside: avoid;
      }
    `;

    printWindow.document.write('<html><head><title>Contrat de Location</title>');
    printWindow.document.write(`<style>${styles}</style>`);
    printWindow.document.write('</head><body>');
    printWindow.document.write(printContent.innerHTML);
    printWindow.document.write('</body></html>');
    
    printWindow.document.close();
    
    printWindow.onload = function() {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  };


  const handleDeleteRental = async (rental: Rental) => {
    if (!firestore || !rental?.id) return;
    
    const rentalDocRef = doc(firestore, 'rentals', rental.id);
    const carDocRef = doc(firestore, 'cars', rental.vehicule.carId);
    
    const batch = writeBatch(firestore);
    
    // If the rental was active, we need to make the car available again.
    if (rental.statut === 'en_cours') {
      batch.update(carDocRef, { disponible: true });
    }
    
    // Now delete the rental document.
    batch.delete(rentalDocRef);

    try {
      await batch.commit();

      toast({
        title: "Contrat supprimé",
        description: "Le contrat de location a été supprimé.",
      });

    } catch (serverError) {
      const permissionError = new FirestorePermissionError({
          path: rentalDocRef.path, // We can be more specific, but this is ok
          operation: 'delete'
      }, serverError as Error);
      errorEmitter.emit('permission-error', permissionError);
      toast({
          variant: "destructive",
          title: "Erreur de suppression",
          description: "Impossible de supprimer ce contrat. L'état de la voiture peut être incorrect.",
      });
    }

    setIsAlertOpen(false);
  };

  const columns: ColumnDef<Rental>[] = [
    {
      accessorKey: "vehicule",
      header: "Voiture",
      cell: ({ row }) => {
        const rental = row.original;
        return rental.vehicule.marque;
      }
    },
    {
      accessorKey: "locataire",
      header: "Client",
      cell: ({ row }) => row.original.locataire.nomPrenom,
    },
    {
      accessorKey: "location.dateFin",
      header: "Date de retour",
      cell: ({ row }) => {
          const date = row.original.location.dateFin;
          if (date && date.toDate) {
            return format(date.toDate(), "dd/MM/yyyy", { locale: fr });
          }
          return "Date invalide";
      }
    },
    {
      accessorKey: "location.montantAPayer",
      header: () => <div className="text-right">Prix Total</div>,
      cell: ({ row }) => (
        <div className="text-right font-medium">
          {formatCurrency(row.original.location.montantAPayer, 'MAD')}
        </div>
      ),
    },
    {
      accessorKey: "statut",
      header: "Statut",
      cell: ({ row }) => (
        <Badge variant={row.getValue("statut") === 'en_cours' ? 'default' : 'outline'} className={row.getValue("statut") === 'en_cours' ? "bg-orange-500/20 text-orange-700" : ""}>
          {row.getValue("statut") === 'en_cours' ? "En cours" : "Terminée"}
        </Badge>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
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
                        Modifier
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

  const table = useReactTable({
    data: rentals,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
        pagination: {
            pageSize: isDashboard ? 5 : 10,
        }
    },
    state: {
      sorting,
      columnFilters,
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
            placeholder="Filtrer par client..."
            value={(table.getColumn("locataire")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("locataire")?.setFilterValue(event.target.value)
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
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader className="no-print">
                    <DialogTitle>Détails du contrat de location #{rentalForModal.id?.substring(0,6)}</DialogTitle>
                    <DialogDesc>
                      Créé le {rentalForModal.createdAt?.toDate ? format(rentalForModal.createdAt.toDate(), "dd LLL, y 'à' HH:mm", { locale: fr }) : 'N/A'}
                    </DialogDesc>
                </DialogHeader>
                <RentalDetails rental={rentalForModal} />
                <DialogFooter className="no-print">
                  <Button variant="outline" onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4"/>
                    Imprimer
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

