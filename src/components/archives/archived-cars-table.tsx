
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
import { MoreHorizontal, Printer, FileText, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Car, Maintenance } from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useFirebase } from "@/firebase";
import { deleteDoc, doc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { getSafeDate } from "@/lib/utils";
import { CarDetails, PrintableCarDetails } from "../cars/car-details-view";

export default function ArchivedCarsTable({ cars }: { cars: Car[] }) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [selectedCar, setSelectedCar] = React.useState<Car | null>(null);
  const [carToDelete, setCarToDelete] = React.useState<Car | null>(null);
  const [historyFilterDate, setHistoryFilterDate] = React.useState<Date | undefined>();

  const groupedMaintenanceHistory = React.useMemo(() => {
    if (!selectedCar?.maintenanceHistory || selectedCar.maintenanceHistory.length === 0) {
        return [];
    }
    const sortedHistory = [...selectedCar.maintenanceHistory].sort((a, b) => {
        const dateA = getSafeDate(a.date);
        const dateB = getSafeDate(b.date);
        if (!dateB) return -1;
        if (!dateA) return 1;
        return dateB.getTime() - dateA.getTime();
    });
    const groups: { [key: string]: { date: Date; kilometrage: number; events: Maintenance[]; totalCost: number } } = {};
    sortedHistory.forEach(event => {
        const eventDate = getSafeDate(event.date);
        if (!eventDate) return;
        const dateKey = format(eventDate, 'yyyy-MM-dd');
        if (!groups[dateKey]) {
            groups[dateKey] = { date: eventDate, kilometrage: event.kilometrage, events: [], totalCost: 0 };
        }
        groups[dateKey].events.push(event);
        groups[dateKey].totalCost += event.cout ?? 0;
    });
    return Object.values(groups);
  }, [selectedCar?.maintenanceHistory]);

  const filteredHistory = React.useMemo(() => {
    if (!historyFilterDate) {
        return groupedMaintenanceHistory;
    }
    const filterDateStr = format(historyFilterDate, 'yyyy-MM-dd');
    return groupedMaintenanceHistory.filter(group => {
        const groupDateStr = format(group.date, 'yyyy-MM-dd');
        return groupDateStr === filterDateStr;
    });
  }, [groupedMaintenanceHistory, historyFilterDate]);

  const handleDeletePermanently = async (carId: string) => {
    if (!firestore) return;
    const carDocRef = doc(firestore, 'archived_cars', carId);
    
    try {
        await deleteDoc(carDocRef);
        toast({
            title: "Archive supprimée",
            description: "La voiture a été définitivement supprimée des archives.",
        });
    } catch(serverError) {
        const permissionError = new FirestorePermissionError({
            path: carDocRef.path,
            operation: 'delete'
        }, serverError as Error);
        errorEmitter.emit('permission-error', permissionError);
        toast({
            variant: "destructive",
            title: "Erreur de suppression",
            description: "Vous n'avez pas la permission de supprimer cette archive.",
        });
    } finally {
        setCarToDelete(null);
    }
  };

  const handlePrint = () => {
    if (!selectedCar) return;
    const printContent = document.getElementById(`printable-details-${selectedCar.id}`);
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
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
       }
      .no-print { display: none !important; }
       @page {
        size: A4;
        margin: 15mm;
      }
      .printable-group:not(:last-child) {
        page-break-after: always;
      }
    `;
    printWindow.document.write('<html><head><title>Fiche de suivi du véhicule</title>');
    Array.from(document.styleSheets).forEach(sheet => {
        if (sheet.href) {
            printWindow.document.write(`<link rel="stylesheet" href="${sheet.href}">`);
        }
    });
    printWindow.document.write(`<style>${styles}</style></head><body>`);
    printWindow.document.write(printContent.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.onload = function() {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 500);
    };
  };

  const columns: ColumnDef<Car>[] = [
    {
      accessorKey: "marque",
      header: "Marque & Modèle",
      cell: ({ row }) => `${row.original.marque} ${row.original.modele}`,
    },
    {
      accessorKey: "immat",
      header: "Immatriculation",
    },
    {
      accessorKey: "kilometrage",
      header: "Kilométrage",
      cell: ({ row }) => `${row.original.kilometrage.toLocaleString()} km`,
    },
    {
      accessorKey: "dateMiseEnCirculation",
      header: "Mise en circulation",
      cell: ({ row }) => {
        const date = getSafeDate(row.original.dateMiseEnCirculation);
        return date ? format(date, "dd/MM/yyyy", { locale: fr }) : "N/A";
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const car = row.original;
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
                setSelectedCar(car);
                setIsDetailsOpen(true);
              }}>
                <FileText className="mr-2 h-4 w-4"/>
                Voir la fiche
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => {
                setSelectedCar(car);
                setTimeout(() => setIsDetailsOpen(true), 100);
                setTimeout(() => handlePrint(), 300);
              }}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                onSelect={() => setCarToDelete(car)}
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
    data: cars,
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
  });

  return (
    <>
      <div className="w-full">
        <div className="flex items-center py-4 gap-2">
          <Input
            placeholder="Filtrer par marque ou modèle..."
            value={(table.getColumn("marque")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("marque")?.setFilterValue(event.target.value)
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
                    Aucun véhicule archivé.
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
          if (!open) setSelectedCar(null);
        }}>
        {selectedCar && (
            <DialogContent className="sm:max-w-lg">
                <DialogHeader className="no-print">
                    <DialogTitle>Fiche du véhicule archivé</DialogTitle>
                    <DialogDescription>{selectedCar.marque} {selectedCar.modele} - {selectedCar.immat}</DialogDescription>
                </DialogHeader>
                <div className="hidden">
                    <PrintableCarDetails car={selectedCar} history={filteredHistory} />
                </div>
                <CarDetails 
                    car={selectedCar} 
                    groupedMaintenanceHistory={groupedMaintenanceHistory}
                    filteredHistory={filteredHistory}
                    historyFilterDate={historyFilterDate}
                    setHistoryFilterDate={setHistoryFilterDate}
                    isArchived={true}
                />
                <DialogFooter className="no-print">
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4"/>
                        Imprimer la fiche
                    </Button>
                </DialogFooter>
            </DialogContent>
        )}
      </Dialog>
      
      <AlertDialog open={!!carToDelete} onOpenChange={(open) => !open && setCarToDelete(null)}>
        {carToDelete && (
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer cette archive ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. La voiture {carToDelete.marque} {carToDelete.modele} sera définitivement supprimée des archives.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={() => handleDeletePermanently(carToDelete.id)} 
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
