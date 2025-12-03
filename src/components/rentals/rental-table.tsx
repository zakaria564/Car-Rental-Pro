
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

type RentalTableProps = {
  rentals: Rental[];
  isDashboard?: boolean;
};

function RentalDetails({ rental }: { rental: Rental }) {
    return (
        <div className="space-y-4">
            <div>
                <h3 className="font-semibold text-lg mb-2">Détails de la voiture</h3>
                <div className="flex items-start gap-4">
                    <Image
                        src={rental.voiture.photoURL}
                        alt={`${rental.voiture.marque} ${rental.voiture.modele}`}
                        width={128}
                        height={96}
                        className="rounded-md object-cover"
                        data-ai-hint="car photo"
                    />
                    <div className="text-sm space-y-1">
                        <p><strong>Marque/Modèle :</strong> {rental.voiture.marque} {rental.voiture.modele}</p>
                        <p><strong>Immatriculation :</strong> {rental.voiture.immat}</p>
                        <p><strong>État :</strong> <span className="capitalize">{rental.voiture.etat}</span></p>
                    </div>
                </div>
            </div>
            <Separator />
            <div>
                <h3 className="font-semibold text-lg mb-2">Informations sur le client</h3>
                <div className="text-sm space-y-1">
                    <p><strong>Nom :</strong> {rental.client.nom}</p>
                    <p><strong>CIN :</strong> {rental.client.cin}</p>
                    <p><strong>Téléphone :</strong> {rental.client.telephone}</p>
                    <p><strong>Adresse :</strong> {rental.client.adresse}</p>
                </div>
            </div>
            <Separator />
            <div>
                <h3 className="font-semibold text-lg mb-2">Informations sur la location</h3>
                <div className="text-sm space-y-1">
                    <p><strong>Période :</strong> du {format(new Date(rental.dateDebut), "dd LLL, y", { locale: fr })} au {format(new Date(rental.dateFin), "dd LLL, y", { locale: fr })}</p>
                    <p><strong>Prix par jour :</strong> {formatCurrency(rental.prixParJour, 'MAD')}</p>
                    <p><strong>Caution :</strong> {formatCurrency(rental.caution, 'MAD')}</p>
                    <p className="font-bold text-base mt-2"><strong>Prix Total :</strong> {formatCurrency(rental.prixTotal, 'MAD')}</p>
                </div>
            </div>
        </div>
    );
}


export default function RentalTable({ rentals: initialRentals, isDashboard = false }: RentalTableProps) {
  const { toast } = useToast();
  const [rentals, setRentals] = React.useState(initialRentals);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [selectedRental, setSelectedRental] = React.useState<Rental | null>(null);

  React.useEffect(() => {
    setRentals(initialRentals);
  }, [initialRentals]);

  const handleEndRental = (rentalId: string) => {
    setRentals(prevRentals =>
      prevRentals.map(r =>
        r.id === rentalId
          ? {
              ...r,
              statut: 'terminee',
              voiture: { ...r.voiture, disponible: true },
            }
          : r
      )
    );
    toast({ title: "Location terminée", description: `La location ${rentalId} a été marquée comme terminée.` });
  };

  const columns: ColumnDef<Rental>[] = [
    {
      accessorKey: "voiture",
      header: "Voiture",
      cell: ({ row }) => {
        const rental = row.original;
        return `${rental.voiture.marque} ${rental.voiture.modele}`;
      }
    },
    {
      accessorKey: "client",
      header: "Client",
      cell: ({ row }) => row.original.client.nom,
    },
    {
      accessorKey: "dateFin",
      header: "Date de retour",
      cell: ({ row }) => format(new Date(row.getValue("dateFin")), "dd/MM/yyyy", { locale: fr }),
    },
    {
      accessorKey: "prixTotal",
      header: () => <div className="text-right">Prix Total</div>,
      cell: ({ row }) => (
        <div className="text-right font-medium">
          {formatCurrency(row.getValue("prixTotal"), 'MAD')}
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
                    {rental.statut === 'en_cours' && (
                    <>
                        <DropdownMenuSeparator />
                        <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                Terminer la location
                            </DropdownMenuItem>
                        </AlertDialogTrigger>
                    </>
                    )}
                </DropdownMenuContent>
                </DropdownMenu>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Êtes-vous sûr de vouloir terminer cette location ?</AlertDialogTitle>
                        <AlertDialogDescription>
                        Cette action est irréversible. La voiture sera marquée comme disponible et le statut de la location sera "Terminée".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleEndRental(rental.id)}>Confirmer</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Détails de la location #{rental.id}</DialogTitle>
                        <DialogDescription>
                            Créée le {format(new Date(rental.createdAt), "dd LLL, y 'à' HH:mm", { locale: fr })}
                        </DialogDescription>
                    </DialogHeader>
                    <RentalDetails rental={rental} />
                </DialogContent>
            </AlertDialog>
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
            value={(table.getColumn("client")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("client")?.setFilterValue(event.target.value)
            }
            className="max-w-sm"
          />
          <SheetTrigger asChild>
            <Button className="ml-auto bg-primary hover:bg-primary/90" onClick={() => setSelectedRental(null)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Nouvelle location
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
      <SheetContent className="sm:max-w-[600px]">
        <SheetHeader>
          <SheetTitle>{selectedRental ? "Modifier la location" : "Créer une nouvelle location"}</SheetTitle>
        </SheetHeader>
        <RentalForm rental={selectedRental} onFinished={() => setIsSheetOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

    