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
import { PlusCircle, ArrowUpDown, ChevronDown, MoreHorizontal, User, Trash2, Mail, Phone, MapPin, CreditCard, FileText } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
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
import { cn, getSafeDate } from "@/lib/utils";

// New component for client details
function ClientDetails({ client }: { client: Client }) {
  const safePermisDate = getSafeDate(client.permisDateDelivrance);
  const formattedPermisDate = safePermisDate ? format(safePermisDate, "dd/MM/yyyy", { locale: fr }) : 'N/A';

  return (
    <ScrollArea className="max-h-[75vh] pr-4">
      <div className="space-y-6 pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Identité</h4>
              <p className="text-lg font-bold">{client.nom}</p>
              <p className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> {client.cin}</p>
              {client.email && (
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <a href={`mailto:${client.email}`} className="underline hover:text-primary transition-colors">{client.email}</a>
                </p>
              )}
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contact & Adresse</h4>
              <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> <a href={`tel:${client.telephone}`} className="underline hover:text-primary">{client.telephone}</a></p>
              <p className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-primary mt-1 shrink-0" />
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.adresse)}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="underline hover:text-primary transition-colors"
                >
                  {client.adresse}
                </a>
              </p>
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Permis de conduire</h4>
              <p className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> N°: {client.permisNo || 'N/A'}</p>
              <p className="pl-6 text-sm text-muted-foreground">Délivré le: {formattedPermisDate}</p>
            </div>
          </div>

          <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Carte d'Identité</h4>
              <div className="relative w-full aspect-[16/10] rounded-lg overflow-hidden border-2 bg-muted shadow-sm group">
                  {client.photoCIN && client.photoCIN.startsWith('http') ? (
                      <a href={client.photoCIN} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                        <Image 
                            src={client.photoCIN} 
                            alt={`CIN de ${client.nom}`} 
                            fill 
                            className="object-contain group-hover:scale-105 transition-transform duration-300"
                            data-ai-hint="id card"
                        />
                      </a>
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2">
                          <CreditCard className="h-10 w-10 opacity-20" />
                          <p className="text-xs italic">Aucune image disponible</p>
                      </div>
                  )}
              </div>
          </div>
        </div>

        {client.otherPhotos && client.otherPhotos.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Autres Documents</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {client.otherPhotos.map((photoUrl, index) => (
                  photoUrl && (
                    <a key={index} href={photoUrl} target="_blank" rel="noopener noreferrer" className="relative block aspect-video rounded-md overflow-hidden border bg-muted hover:ring-2 hover:ring-primary transition-all">
                        <Image
                            src={photoUrl}
                            alt={`Document ${index + 1}`}
                            fill
                            className="object-cover"
                            data-ai-hint="client document"
                        />
                    </a>
                  )
                ))}
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
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({ email: false });
  const [rowSelection, setRowSelection] = React.useState({});
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const handleDeleteClient = async (clientId: string) => {
    if (!firestore) return;
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
      cell: ({ row }) => <div className="font-bold text-foreground">{row.getValue("nom")}</div>,
    },
    {
      accessorKey: "cin",
      header: "CIN",
      cell: ({ row }) => <Badge variant="outline" className="font-mono">{row.getValue("cin")}</Badge>,
    },
    {
      accessorKey: "email",
      header: "E-mail",
      cell: ({ row }) => {
        const email = row.getValue("email") as string;
        return email ? (
            <a href={`mailto:${email}`} className="text-primary hover:underline flex items-center gap-1.5 text-xs">
                <Mail className="h-3 w-3" />
                {email}
            </a>
        ) : <span className="text-muted-foreground italic text-[10px]">N/A</span>;
      },
    },
    {
      accessorKey: "telephone",
      header: "Téléphone",
      cell: ({ row }) => {
        const telephone = row.getValue("telephone") as string;
        return (
            <a href={`tel:${telephone}`} className="hover:text-primary transition-colors flex items-center gap-1.5 font-medium">
                <Phone className="h-3 w-3 opacity-50" />
                {telephone}
            </a>
        );
      },
    },
    {
      accessorKey: "adresse",
      header: "Adresse",
      cell: ({ row }) => {
        const adresse = row.getValue("adresse") as string;
        return (
            <div className="flex items-center gap-1.5 max-w-[200px]">
                <MapPin className="h-3 w-3 opacity-50 shrink-0" />
                <span className="truncate text-xs text-muted-foreground">{adresse}</span>
            </div>
        );
      },
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
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => { setSelectedClient(client); setIsDetailsOpen(true); }}>
                  <User className="mr-2 h-4 w-4" />
                  Voir la fiche complète
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSelectedClient(client); setIsSheetOpen(true); }}>
                  <FileText className="mr-2 h-4 w-4" />
                  Modifier
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                 <AlertDialogTrigger asChild>
                    <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer le client
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>
             <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. Toutes les données du client {client.nom} seront perdues.
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
              placeholder="Rechercher par nom..."
              value={(table.getColumn("nom")?.getFilterValue() as string) ?? ""}
              onChange={(event) =>
                table.getColumn("nom")?.setFilterValue(event.target.value)
              }
              className="max-w-sm"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-auto">
                  Affichage <ChevronDown className="ml-2 h-4 w-4" />
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
                <PlusCircle className="mr-2 h-4 w-4" /> Ajouter client
              </Button>
            </SheetTrigger>
          </div>
          <div className="rounded-md border bg-card shadow-sm">
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
                      className="hover:bg-muted/30"
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
                      Aucun client trouvé.
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
        <SheetContent className="sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle>{selectedClient ? "Modifier le client" : "Nouveau client"}</SheetTitle>
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
            {selectedClient && <DialogDescription>Fiche complète pour {selectedClient.nom}.</DialogDescription>}
          </DialogHeader>
          {selectedClient && <ClientDetails client={selectedClient} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
