
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
import { PlusCircle, ArrowUpDown, ChevronDown, MoreHorizontal, User, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
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
import type { Client } from "@/lib/definitions";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import ClientForm from "./client-form";
import { ScrollArea } from "../ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import { useFirebase } from "@/firebase";
import { deleteDoc, doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import Image from "next/image";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

// New component for client details
function ClientDetails({ client }: { client: Client }) {
  const safePermisDate = client.permisDateDelivrance?.toDate ? format(client.permisDateDelivrance.toDate(), "dd/MM/yyyy", { locale: fr }) : 'N/A';

  return (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-4 pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          <div className="space-y-1 text-sm">
            <p><strong>Nom:</strong> {client.nom}</p>
            <p><strong>CIN:</strong> {client.cin}</p>
            <p><strong>Téléphone:</strong> <a href={`tel:${client.telephone}`} className="underline text-primary hover:text-primary/80">{client.telephone}</a></p>
            <p><strong>Adresse:</strong> <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.adresse)}`} target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">{client.adresse}</a></p>
            <p><strong>N° Permis:</strong> {client.permisNo || 'N/A'}</p>
            <p><strong>Délivré le:</strong> {safePermisDate}</p>
          </div>
          <div className="space-y-2">
              <p className="text-sm font-medium">Photo de la CIN</p>
              <div className="relative w-full aspect-[16/10] rounded-md overflow-hidden border bg-muted">
                  {client.photoCIN && client.photoCIN.startsWith('http') ? (
                      <a href={client.photoCIN} target="_blank" rel="noopener noreferrer" className="block w-full h-full hover:opacity-80 transition-opacity">
                        <Image 
                            src={client.photoCIN} 
                            alt={`CIN de ${client.nom}`} 
                            fill 
                            className="object-cover"
                            data-ai-hint="id card"
                        />
                      </a>
                  ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                          Pas d'image
                      </div>
                  )}
              </div>
          </div>
        </div>
        {client.otherPhotos && client.otherPhotos.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <p className="text-sm font-medium">Autres Photos</p>
            <div className="overflow-x-auto pb-2">
              <div className="flex w-max space-x-2">
                {client.otherPhotos.map((photoUrl, index) => (
                  photoUrl && (
                    <a key={index} href={photoUrl} target="_blank" rel="noopener noreferrer" className="relative block h-20 w-28 flex-shrink-0 rounded-md overflow-hidden bg-muted hover:opacity-80 transition-opacity">
                        <Image
                            src={photoUrl}
                            alt={`Autre photo ${index + 1}`}
                            fill
                            className="object-cover"
                            data-ai-hint="client document"
                        />
                    </a>
                  )
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}


export default function ClientTable({ clients }: { clients: Client[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const handleDeleteClient = async (clientId: string) => {
    const clientDocRef = doc(firestore, 'clients', clientId);
    
    deleteDoc(clientDocRef).catch(serverError => {
        const permissionError = new FirestorePermissionError({
            path: clientDocRef.path,
            operation: 'delete'
        }, serverError as Error);
        errorEmitter.emit('permission-error', permissionError);
        toast({
            variant: "destructive",
            title: "Erreur de suppression",
            description: "Vous n'avez pas la permission de supprimer ce client.",
        });
    });

    toast({
        title: "Client supprimé",
        description: "Le client a été supprimé de la base de données.",
    });
  };

  const columns: ColumnDef<Client>[] = [
    {
      accessorKey: "nom",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Nom
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="font-medium">{row.getValue("nom")}</div>,
    },
    {
      accessorKey: "cin",
      header: "CIN",
    },
    {
      accessorKey: "telephone",
      header: "Téléphone",
    },
    {
      accessorKey: "adresse",
      header: "Adresse",
      cell: ({ row }) => <div className="truncate max-w-[200px]">{row.getValue("adresse") as string}</div>,
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const client = row.original;
        return (
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
                <DropdownMenuItem onClick={() => { setSelectedClient(client); setIsDetailsOpen(true); }}>
                  <User className="mr-2 h-4 w-4" />
                  Voir les informations
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSelectedClient(client); setIsSheetOpen(true); }}>
                  Modifier
                </DropdownMenuItem>
                 <AlertDialogTrigger asChild>
                    <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">Supprimer</DropdownMenuItem>
                  </AlertDialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>
             <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. Le client {client.nom} sera définitivement supprimé.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDeleteClient(client.id)} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>
        );
      },
    },
  ];

  const table = useReactTable({
    data: clients,
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

  return (
    <>
      <Sheet open={isSheetOpen} onOpenChange={(open) => {
        setIsSheetOpen(open);
        if (!open) setSelectedClient(null);
      }}>
        <div className="w-full">
          <div className="flex items-center py-4 gap-2">
            <Input
              placeholder="Filtrer par nom..."
              value={(table.getColumn("nom")?.getFilterValue() as string) ?? ""}
              onChange={(event) =>
                table.getColumn("nom")?.setFilterValue(event.target.value)
              }
              className="max-w-sm"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-auto">
                  Colonnes <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {column.id === 'adresse' ? 'Adresse' : column.id}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
            <SheetTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90" onClick={() => setSelectedClient(null)}>
                <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un client
              </Button>
            </SheetTrigger>
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
                      Aucun résultat.
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
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedClient ? "Modifier le client" : "Ajouter un nouveau client"}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-full pr-6">
              <ClientForm client={selectedClient} onFinished={() => setIsSheetOpen(false)} />
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Dialog open={isDetailsOpen} onOpenChange={(open) => {
        setIsDetailsOpen(open);
        if (!open) setSelectedClient(null);
      }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Détails du client</DialogTitle>
            {selectedClient && <DialogDescription>Informations complètes pour {selectedClient.nom}.</DialogDescription>}
          </DialogHeader>
          {selectedClient && <ClientDetails client={selectedClient} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
