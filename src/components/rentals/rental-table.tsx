
"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { PlusCircle, MoreHorizontal } from "lucide-react";
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
import type { Rental } from "@/lib/definitions";
import { formatCurrency } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import RentalForm from "./rental-form";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "../ui/separator";
import Image from "next/image";
import { ScrollArea } from "../ui/scroll-area";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useFirebase } from "@/firebase";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

type RentalTableProps = {
  rentals: Rental[];
  isDashboard?: boolean;
};

function RentalDetails({ rental }: { rental: Rental }) {
    return (
      <ScrollArea className="h-[70vh] pr-4">
        <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <h3 className="font-semibold text-base col-span-2">Locataire</h3>
                <p><strong>Nom & Prénom:</strong> {rental.locataire.nomPrenom}</p>
                <p><strong>CIN/Passeport:</strong> {rental.locataire.cin}</p>
                <p><strong>N° de Permis:</strong> {rental.locataire.permisNo}</p>
                <p><strong>Téléphone:</strong> {rental.locataire.telephone}</p>
            </div>
            <Separator />
             <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <h3 className="font-semibold text-base col-span-2">Véhicule</h3>
                <div className="col-span-2">
                   <Image
                        src={rental.vehicule.photoURL}
                        alt={rental.vehicule.marque}
                        width={128}
                        height={96}
                        className="rounded-md object-cover float-right ml-4 mb-2"
                        data-ai-hint="car photo"
                    />
                    <p><strong>Immatriculation:</strong> {rental.vehicule.immatriculation}</p>
                    <p><strong>Marque/Modèle:</strong> {rental.vehicule.marque}</p>
                    <p><strong>Année Modèle:</strong> {rental.vehicule.modeleAnnee}</p>
                    <p><strong>Couleur:</strong> {rental.vehicule.couleur}</p>
                    <p><strong>Nbr de Places:</strong> {rental.vehicule.nbrPlaces}</p>
                    <p><strong>Puissance:</strong> {rental.vehicule.puissance} ch</p>
                    <p><strong>Carburant:</strong> {rental.vehicule.carburantType}</p>
                </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <h3 className="font-semibold text-base col-span-2">Détails de Livraison (Départ)</h3>
                <p><strong>Date & Heure:</strong> {format(rental.livraison.dateHeure.toDate(), "dd/MM/yyyy HH:mm", { locale: fr })}</p>
                <p><strong>Kilométrage:</strong> {rental.livraison.kilometrage.toLocaleString()} km</p>
                <p><strong>Niveau Carburant:</strong> {rental.livraison.carburantNiveau * 100}%</p>
                <p><strong>Roue de Secours:</strong> {rental.livraison.roueSecours ? 'Oui' : 'Non'}</p>
                <p><strong>Poste Radio:</strong> {rental.livraison.posteRadio ? 'Oui' : 'Non'}</p>
                <p><strong>Lavage:</strong> {rental.livraison.lavage ? 'Propre' : 'Sale'}</p>
                {rental.livraison.dommages && rental.livraison.dommages.length > 0 && <p className="col-span-2"><strong>Dommages:</strong> {rental.livraison.dommages.join(', ')}</p>}
                 {rental.livraison.dommagesNotes && <p className="col-span-2"><strong>Notes (Départ):</strong> {rental.livraison.dommagesNotes}</p>}
            </div>
            <Separator />
             {rental.reception.dateHeure && (
                <>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <h3 className="font-semibold text-base col-span-2">Détails de Réception (Retour)</h3>
                        <p><strong>Date & Heure:</strong> {format(rental.reception.dateHeure.toDate(), "dd/MM/yyyy HH:mm", { locale: fr })}</p>
                        <p><strong>Kilométrage:</strong> {rental.reception.kilometrage?.toLocaleString()} km</p>
                        <p><strong>Niveau Carburant:</strong> {rental.reception.carburantNiveau ? rental.reception.carburantNiveau * 100 + '%' : 'N/A'}</p>
                        {rental.reception.dommagesNotes && <p className="col-span-2"><strong>Notes (Retour):</strong> {rental.reception.dommagesNotes}</p>}
                    </div>
                    <Separator />
                </>
             )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <h3 className="font-semibold text-base col-span-2">Détails Financiers</h3>
                <p><strong>Prix/Jour:</strong> {formatCurrency(rental.location.prixParJour, 'MAD')}</p>
                <p><strong>Nombre de Jours:</strong> {rental.location.nbrJours}</p>
                <p><strong>Dépôt de Garantie:</strong> {rental.location.depot ? formatCurrency(rental.location.depot, 'MAD') : 'N/A'}</p>
                <p className="font-bold text-lg"><strong>Montant à Payer:</strong> {formatCurrency(rental.location.montantAPayer, 'MAD')}</p>
            </div>
        </div>
      </ScrollArea>
    );
}


export default function RentalTable({ rentals, isDashboard = false }: RentalTableProps) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [selectedRental, setSelectedRental] = React.useState<Rental | null>(null);

  const handleEndRental = async (rental: Rental) => {
    if (!rental.id || !rental.vehicule.carId) return;
    const rentalDocRef = doc(firestore, 'rentals', rental.id);
    const carDocRef = doc(firestore, 'cars', rental.vehicule.carId);
    
    try {
        await updateDoc(rentalDocRef, { statut: 'terminee' });
        await updateDoc(carDocRef, { disponible: true });
        toast({ title: "Location terminée", description: `La location a été marquée comme terminée.` });
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: "Erreur", description: "Impossible de terminer la location."});
    }
  };

  const handleDeleteRental = async (rentalId: string) => {
    if (!firestore) return;
    const rentalDocRef = doc(firestore, 'rentals', rentalId);
    
    deleteDoc(rentalDocRef).then(() => {
        toast({
            title: "Contrat supprimé",
            description: "Le contrat de location a été supprimé de la base de données.",
        });
    }).catch(serverError => {
        const permissionError = new FirestorePermissionError({
            path: rentalDocRef.path,
            operation: 'delete'
        }, serverError as Error);
        errorEmitter.emit('permission-error', permissionError);
        toast({
            variant: "destructive",
            title: "Erreur de suppression",
            description: "Vous n'avez pas la permission de supprimer ce contrat.",
        });
    });
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
      cell: ({ row }) => format(row.original.location.dateFin.toDate(), "dd/MM/yyyy", { locale: fr }),
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
          <Dialog>
            <AlertDialog>
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Ouvrir le menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DialogTrigger asChild>
                    <DropdownMenuItem>
                        Voir les détails
                    </DropdownMenuItem>
                    </DialogTrigger>
                    <DropdownMenuSeparator />
                    {rental.statut === 'en_cours' ? (
                        <AlertDialogTrigger asChild>
                            <DropdownMenuItem>
                            Terminer la location
                            </DropdownMenuItem>
                        </AlertDialogTrigger>
                    ) : (
                        <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                            Supprimer
                            </DropdownMenuItem>
                        </AlertDialogTrigger>
                    )}
                </DropdownMenuContent>
                </DropdownMenu>
                <AlertDialogContent>
                    {rental.statut === 'en_cours' ? (
                        <>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                Cette action marquera la location comme "Terminée" et rendra la voiture à nouveau disponible.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleEndRental(rental)}>Confirmer</AlertDialogAction>
                            </AlertDialogFooter>
                        </>
                    ) : (
                        <>
                             <AlertDialogHeader>
                                <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Cette action est irréversible. Le contrat de location sera définitivement supprimé.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteRental(rental.id)} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
                            </AlertDialogFooter>
                        </>
                    )}
                </AlertDialogContent>
            </AlertDialog>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Détails du contrat de location #{rental.id?.substring(0,6)}</DialogTitle>
                <DialogDescription>
                  Créé le {rental.createdAt ? format(rental.createdAt.toDate(), "dd LLL, y 'à' HH:mm", { locale: fr }) : 'N/A'}
                </DialogDescription>
              </DialogHeader>
              <RentalDetails rental={rental} />
            </DialogContent>
          </Dialog>
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
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  if (isDashboard) {
    return (
       <div className="rounded-md border bg-card">
         <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })}
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

  return (
    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
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
          <SheetTrigger asChild>
            <Button className="ml-auto bg-primary hover:bg-primary/90" onClick={() => setSelectedRental(null)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter contrat
            </Button>
          </SheetTrigger>
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
      <SheetContent className="sm:max-w-[600px] flex flex-col">
        <SheetHeader>
          <SheetTitle>{selectedRental ? "Modifier le contrat" : "Créer un nouveau contrat"}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-grow pr-6">
            <RentalForm rental={selectedRental} onFinished={() => setIsSheetOpen(false)} />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

    
    