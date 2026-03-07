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
import { MoreHorizontal, Printer, FileText, Trash2, Pencil } from "lucide-react";
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
import { cn, getSafeDate, getRentalDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RentalDetails } from "../rentals/rental-contract-views";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useFirebase } from "@/firebase";
import { deleteDoc, doc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import RentalForm from "../rentals/rental-form";

type ArchiveTableProps = {
  rentals: Rental[];
  clients: Client[];
  cars: Car[];
};

export default function ArchiveTable({ rentals, clients, cars }: ArchiveTableProps) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
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
      header: () => <div className="text-[12px] font-bold text-foreground">Client</div>,
      cell: ({ row, getValue }) => {
        return (
          <div className="pl-2 text-[12px] font-medium">
            {getValue() as string}
          </div>
        );
      },
    },
    {
      accessorKey: "contractNumber",
      header: () => <div className="text-[12px] font-bold text-foreground">Contrat N°</div>,
       cell: ({ row }) => {
        return <span className="font-mono text-[12px]">{row.original.contractNumber}</span>;
       },
    },
    {
      accessorKey: "vehicule.marque",
      header: () => <div className="text-[12px] font-bold text-foreground">Voiture</div>,
       cell: ({ row }) => {
        return <span className="text-[12px]">{row.original.vehicule.marque}</span>;
       },
    },
    {
      accessorKey: "vehicule.immatriculation",
      header: () => <div className="text-[12px] font-bold text-foreground">Immatriculation</div>,
       cell: ({ row }) => {
        return <Badge variant="secondary" className="font-mono text-[12px]">{row.original.vehicule.immatriculation}</Badge>;
       },
    },
     {
      id: "dateDebut",
      header: () => <div className="text-[12px] font-bold text-foreground">Date départ</div>,
      cell: ({ row }) => {
        const date = getRentalDate(row.original, 'dateDebut');
        return <span className="text-[12px]">{date ? format(date, "dd/MM/yyyy", { locale: fr }) : "N/A"}</span>;
      },
    },
    {
      id: "dateFin",
      header: () => <div className="text-[12px] font-bold text-foreground">Date retour</div>,
      cell: ({ row }) => {
        const date = getRentalDate(row.original, 'dateFin');
        return <span className="text-[12px]">{date ? format(date, "dd/MM/yyyy", { locale: fr }) : "N/A"}</span>;
      },
    },
    {
      accessorKey: "statut",
      header: () => <div className="text-[12px] font-bold text-foreground">Statut Final</div>,
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
                {status === 'en_cours' ? "En cours" : "Terminée"}
            </Badge>
        );
      },
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
              <DropdownMenuLabel className="text-[12px]">Actions</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => {
                setSelectedRental(rental);
                setIsDetailsOpen(true);
              }} className="text-[12px]">
                <FileText className="mr-2 h-4 w-4"/>
                Voir les détails
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => {
                setSelectedRental(rental);
                setIsSheetOpen(true);
              }} className="text-[12px]">
                <Pencil className="mr-2 h-4 w-4"/>
                Modifier
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive focus:bg-destructive/10 text-[12px]"
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
    state: {
      sorting,
      columnFilters,
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
                    <TableHead key={header.id} className="text-[12px] font-bold text-foreground">
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
                      <TableCell key={cell.id} className="text-[12px]">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-[12px]">
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

      <Sheet open={isSheetOpen} onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) setSelectedRental(null);
      }}>
        <SheetContent className="sm:max-w-[600px] flex flex-col">
            <SheetHeader>
              <SheetTitle>Modifier le contrat (Archive)</SheetTitle>
              {selectedRental && (
                <SheetDescription>
                    {selectedRental.vehicule.marque} ({selectedRental.vehicule.immatriculation})
                </SheetDescription>
              )}
            </SheetHeader>
            <ScrollArea className="flex-grow pr-6">
              <RentalForm 
                key={selectedRental?.id || 'edit-archived'}
                rental={selectedRental} 
                clients={clients} 
                cars={cars} 
                rentals={[]}
                mode="edit"
                onFinished={() => setIsSheetOpen(false)} />
            </ScrollArea>
        </SheetContent>
      </Sheet>
      
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
