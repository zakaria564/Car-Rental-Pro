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
import { cn, getSafeDate } from "@/lib/utils";
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
            title: "Suppression définitive",
            description: "Le contrat a été supprimé définitivement.",
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
            description: "Vous n'avez pas la permission de supprimer cet élément.",
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

    // Collect all styles from the current document
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

    printWindow.document.write('<html><head><title>Contrat de Location (Archive)</title>');
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

  const columns: ColumnDef<Rental>[] = [
    {
      id: "client",
      accessorFn: (row) => row.locataire.nomPrenom,
      header: "Client",
      cell: ({ row, getValue }) => {
        if (row.getIsGrouped()) {
            return (
                <Button
                    variant="ghost"
                    onClick={() => row.toggleExpanded()}
                    className="w-full text-left justify-start pl-2 hover:bg-muted/50"
                >
                    <span className="flex items-center gap-2 font-bold text-base">
                        {row.getIsExpanded() ? (
                            <ChevronDown className="h-5 w-5" />
                        ) : (
                            <ChevronRight className="h-5 w-5" />
                        )}
                        {getValue() as string}
                        <Badge variant="outline" className="ml-2">
                            {row.subRows.length}
                        </Badge>
                    </span>
                </Button>
            );
        }
        return (
          <div className={cn("pl-10 text-muted-foreground italic text-xs flex items-center gap-2")}>
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
        const rental = row.getIsGrouped() ? row.subRows[0]?.original : row.original;
        return <span className={cn("font-mono", row.getIsGrouped() && "text-muted-foreground")}>{rental.contractNumber}</span>;
       },
    },
    {
      accessorKey: "vehicule.marque",
      header: "Voiture",
       cell: ({ row }) => {
        const rental = row.getIsGrouped() ? row.subRows[0]?.original : row.original;
        return <span className={cn(row.getIsGrouped() && "text-muted-foreground")}>{rental.vehicule.marque}</span>;
       },
    },
    {
      accessorKey: "vehicule.immatriculation",
      header: "Immatriculation",
       cell: ({ row }) => {
        const rental = row.getIsGrouped() ? row.subRows[0]?.original : row.original;
        return <Badge variant="secondary" className={cn("font-mono text-[10px]", row.getIsGrouped() && "opacity-70")}>{rental.vehicule.immatriculation}</Badge>;
       },
    },
     {
      accessorKey: "location.dateDebut",
      header: "Date départ",
      cell: ({ row }) => {
        const rental = row.getIsGrouped() ? row.subRows[0]?.original : row.original;
        const date = getSafeDate(rental.location.dateDebut);
        return <span className={cn(row.getIsGrouped() && "text-muted-foreground text-xs")}>{date ? format(date, "dd/MM/yyyy", { locale: fr }) : "N/A"}</span>;
      },
    },
    {
      accessorKey: "location.dateFin",
      header: "Date retour",
      cell: ({ row }) => {
        const rental = row.getIsGrouped() ? row.subRows[0]?.original : row.original;
        const date = getSafeDate(rental.location.dateFin);
        return <span className={cn(row.getIsGrouped() && "text-muted-foreground text-xs")}>{date ? format(date, "dd/MM/yyyy", { locale: fr }) : "N/A"}</span>;
      },
    },
    {
      accessorKey: "statut",
      header: "Statut Final",
      cell: ({ row }) => {
        const rental = row.getIsGrouped() ? row.subRows[0]?.original : row.original;
        const status = rental.statut;
        return (
            <Badge
                variant={status === "en_cours" ? "default" : "outline"}
                className={cn(
                    status === "en_cours" ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-green-100 text-green-700 border-green-200",
                    row.getIsGrouped() && "scale-90 opacity-80"
                )}
            >
                {status === 'en_cours' ? "En cours" : "Terminée"}
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
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                onSelect={() => setRentalToDelete(rental)}
              >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer définitivement
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
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="font-bold text-foreground">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className={cn(row.getIsGrouped() ? "bg-muted/30" : "hover:bg-muted/20")}>
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
                    <DialogTitle>Détails du contrat #{selectedRental.contractNumber}</DialogTitle>
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
                    <AlertDialogTitle>Supprimer définitivement ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Le contrat N° {rentalToDelete.contractNumber} sera définitivement supprimé.
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
