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
import { MoreHorizontal, Printer, FileText, Trash2, ChevronRight, ChevronDown } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription as DialogDesc, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RentalDetails } from "../rentals/rental-contract-views";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useFirebase } from "@/firebase";
import { deleteDoc, doc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

export default function ArchiveTable({ rentals }: { rentals: Rental[] }) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [grouping, setGrouping] = React.useState<GroupingState>(['client']);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [selectedRental, setSelectedRental] = React.useState<Rental | null>(null);
  const [rentalToDelete, setRentalToDelete] = React.useState<Rental | null>(null);

  const handleDeleteArchivedRental = async (rentalId: string) => {
    if (!firestore) return;
    const rentalDocRef = doc(firestore, 'archived_rentals', rentalId);
    
    try {
        await deleteDoc(rentalDocRef);
        toast({
            title: "Archive supprimée",
            description: "Le contrat a été supprimé des archives.",
        });
    } catch(serverError) {
        const permissionError = new FirestorePermissionError({
            path: rentalDocRef.path,
            operation: 'delete'
        }, serverError as Error);
        errorEmitter.emit('permission-error', permissionError);
        toast({
            variant: "destructive",
            title: "Erreur de suppression",
            description: "Vous n'avez pas la permission de supprimer cette archive.",
        });
    } finally {
        setRentalToDelete(null); // Close the dialog
    }
  };


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

    printWindow.document.write('<html><head><title>Contrat de Location (Archive)</title>');
    
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

  const columns: ColumnDef<Rental>[] = [
    {
      accessorKey: "contractNumber",
      header: "Contrat N°",
       cell: ({ row }) => row.getIsGrouped() ? null : row.getValue("contractNumber"),
    },
    {
      accessorKey: "vehicule.marque",
      header: "Voiture",
       cell: ({ row }) => row.getIsGrouped() ? null : row.original.vehicule.marque,
    },
    {
      accessorKey: "vehicule.immatriculation",
      header: "Immatriculation",
       cell: ({ row }) => row.getIsGrouped() ? null : row.original.vehicule.immatriculation,
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
                        {row.getValue("client")} ({row.subRows.length})
                    </span>
                </Button>
            );
        }
        return null;
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
      header: "Date retour",
      cell: ({ row }) => {
         if (row.getIsGrouped()) return null;
        const date = row.original.location.dateFin?.toDate ? row.original.location.dateFin.toDate() : null;
        return date ? format(date, "dd/MM/yyyy", { locale: fr }) : "N/A";
      },
    },
    {
      accessorKey: "statut",
      header: "Statut Final",
      cell: ({ row }) => {
         if (row.getIsGrouped()) return null;
        return (
            <Badge
                variant={row.getValue("statut") === "en_cours" ? "default" : "outline"}
                className={cn(row.getValue("statut") === "en_cours" ? "bg-yellow-500/20 text-yellow-700" : "bg-green-100 text-green-800 border-green-300")}
            >
                {row.getValue("statut") === 'en_cours' ? "Non Terminé" : "Terminée"}
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
                setSelectedRental(rental);
                setIsDetailsOpen(true);
              }}>
                <FileText className="mr-2 h-4 w-4"/>
                Voir les détails
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => {
                setSelectedRental(rental);
                // We need to set it, then open the dialog, then print. A bit of a hack.
                setTimeout(() => setIsDetailsOpen(true), 100);
                setTimeout(() => handlePrint(), 300);
              }}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                onSelect={() => setRentalToDelete(rental)}
              >
                  <Trash2 className="mr-2 h-4 w-4" />
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
                    Aucun contrat archivé.
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
      
      <Dialog open={isDetailsOpen} onOpenChange={(open) => {
          setIsDetailsOpen(open);
          if (!open) setSelectedRental(null);
        }}>
        {selectedRental && (
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader className="no-print">
                    <DialogTitle>Détails du contrat archivé #{selectedRental.contractNumber}</DialogTitle>
                </DialogHeader>
                <RentalDetails rental={selectedRental} isArchived={true} />
                <DialogFooter className="no-print">
                  <Button variant="outline" onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4"/>
                    Imprimer le contrat
                  </Button>
                </DialogFooter>
            </DialogContent>
        )}
      </Dialog>
      
      <AlertDialog open={!!rentalToDelete} onOpenChange={(open) => !open && setRentalToDelete(null)}>
        {rentalToDelete && (
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer cette archive ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Le contrat archivé N° {rentalToDelete.contractNumber} sera définitivement supprimé. Le contrat actif ne sera pas affecté.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={() => handleDeleteArchivedRental(rentalToDelete.id)} 
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
