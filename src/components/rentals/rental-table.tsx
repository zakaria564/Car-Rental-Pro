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
import { PlusCircle, MoreHorizontal, Printer, Pencil, CheckCircle, FileText, DollarSign } from "lucide-react";
import { format, startOfDay, isToday } from "date-fns";
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
import { cn, formatCurrency, getRentalDate, calculateTotalRentalAmount } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import RentalForm from "./rental-form";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { runTransaction, doc } from "firebase/firestore";
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
  const [grouping, setGrouping] = React.useState<GroupingState>([]);
  const [formMode, setFormMode] = React.useState<'new' | 'edit' | 'check-in'>('new');

  // State for the modals
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [isAlertOpen, setIsAlertOpen] = React.useState(false);
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = React.useState(false);
  
  // Unified state for the rental being acted upon
  const [rentalForModal, setRentalForModal] = React.useState<Rental | null>(null);
  
  const openSheet = React.useCallback((mode: 'new' | 'edit' | 'check-in', rental: Rental | null) => {
    setRentalForModal(rental);
    setFormMode(mode);
    setIsSheetOpen(true);
  }, []);

  const openDetails = React.useCallback((rental: Rental) => {
      setRentalForModal(rental);
      setIsDetailsOpen(true);
  }, []);

  const openAlert = React.useCallback((rental: Rental) => {
      setRentalForModal(rental);
      setIsAlertOpen(true);
  }, []);
  
  const openPaymentSheet = React.useCallback((rental: Rental) => {
      setRentalForModal(rental);
      setIsPaymentSheetOpen(true);
  }, []);


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
      body { 
        font-family: 'Inter', sans-serif; 
        background-color: white !important;
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important; 
      }
      .no-print { display: none !important; }
      @page {
        size: A4;
        margin: 15mm;
      }
    `;

    printWindow.document.write('<html><head><title>Contrat de Location</title>');
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


  const handleDeleteRental = async (rental: Rental) => {
    if (!firestore || !rental?.id) return;
    const rentalDocRef = doc(firestore, 'rentals', rental.id);
    const carRef = doc(firestore, 'cars', rental.vehicule.carId);
    
    try {
        await runTransaction(firestore, async (transaction) => {
            transaction.delete(rentalDocRef);
            transaction.update(carRef, { disponibilite: 'disponible' });
        });
        toast({ title: "Contrat supprimé", description: "Le contrat a été supprimé." });
    } catch (serverError: any) {
        const permissionError = new FirestorePermissionError({ path: rentalDocRef.path, operation: 'delete' }, serverError);
        errorEmitter.emit('permission-error', permissionError);
    }
    setIsAlertOpen(false);
  };
  
  const columns: ColumnDef<Rental>[] = React.useMemo(() => {
    const cols: ColumnDef<Rental>[] = [
    {
      accessorKey: "contractNumber",
      header: "Contrat N°",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.contractNumber}</span>,
    },
    {
      id: "client",
      accessorFn: (row) => row.locataire.nomPrenom,
      header: "Client",
       cell: ({ row, getValue }) => <div className="font-medium text-xs truncate max-w-[150px]">{getValue() as string}</div>,
    },
    {
      id: "dateDebut",
      header: "Départ",
      cell: ({ row }) => {
        const date = getRentalDate(row.original, 'dateDebut');
        return <span className="text-xs">{date ? format(date, "dd/MM/yyyy", { locale: fr }) : "N/A"}</span>;
      },
    },
    {
      id: "dateFin",
      header: "Retour",
      cell: ({ row }) => {
          const date = getRentalDate(row.original, 'dateFin');
          if (!date) return <span className="text-xs">N/A</span>;
          const isReturnToday = isToday(date);
          const isOverdue = startOfDay(date).getTime() < startOfDay(new Date()).getTime() && row.original.statut === 'en_cours';
          return (
              <div className="flex items-center gap-1.5">
                  <span className={cn("text-xs", isOverdue && "text-destructive font-bold")}>{format(date, "dd/MM/yyyy", { locale: fr })}</span>
                  {(isReturnToday || isOverdue) && row.original.statut === 'en_cours' && (
                    <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span></span>
                  )}
              </div>
          );
      }
    },
    {
      accessorKey: "statut",
      header: "Statut",
      cell: ({ row }) => {
        const status = row.original.statut;
        return <Badge variant={status === "en_cours" ? "secondary" : "default"} className={cn("text-[10px] uppercase", status === "en_cours" ? "bg-blue-600 text-white" : "bg-green-600 text-white")}>{status === "en_cours" ? "En cours" : "Terminée"}</Badge>;
      },
    },
  ];

  if (!isDashboard) {
    cols.push({
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const rental = row.original;
        const total = calculateTotalRentalAmount(rental);
        const paid = rental.location.montantPaye || 0;
        const remaining = total - paid;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => openDetails(rental)} className="text-xs"><FileText className="mr-2 h-4 w-4"/>Détails</DropdownMenuItem>
              {remaining > 0.01 && <DropdownMenuItem onSelect={() => openPaymentSheet(rental)} className="text-xs"><DollarSign className="mr-2 h-4 w-4" />Paiement</DropdownMenuItem>}
              {rental.statut === 'en_cours' && (
                  <>
                    <DropdownMenuItem onSelect={() => openSheet('edit', rental)} className="text-xs"><Pencil className="mr-2 h-4 w-4" />Modifier</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openSheet('check-in', rental)} className="text-xs"><CheckCircle className="mr-2 h-4 w-4" />Réceptionner</DropdownMenuItem>
                  </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive text-xs" onSelect={() => openAlert(rental)}>Supprimer</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    });
  }
  return cols;
  }, [isDashboard, openSheet, openDetails, openAlert, openPaymentSheet]);

  const table = useReactTable({
    data: rentals,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { sorting, columnFilters, grouping },
  });

  return (
    <>
      <div className="w-full">
        <div className="flex items-center py-4 gap-2">
          <Input placeholder="Filtrer..." value={(table.getColumn("contractNumber")?.getFilterValue() as string) ?? ""} onChange={(e) => table.getColumn("contractNumber")?.setFilterValue(e.target.value)} className="max-w-sm" />
           <Button className="ml-auto" onClick={() => openSheet('new', null)}><PlusCircle className="mr-2 h-4 w-4" /> Nouveau contrat</Button>
        </div>
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>{table.getHeaderGroups().map(hg => (<TableRow key={hg.id}>{hg.headers.map(h => (<TableHead key={h.id} className="text-xs font-bold">{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>))}</TableRow>))}</TableHeader>
            <TableBody>{table.getRowModel().rows?.length ? (table.getRowModel().rows.map(r => (<TableRow key={row.id}>{r.getVisibleCells().map(c => (<TableCell key={c.id} className="text-xs">{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>))}</TableRow>))) : (<TableRow><TableCell colSpan={columns.length} className="h-24 text-center text-xs">Aucun résultat.</TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
      </div>
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-[600px] flex flex-col">
            <SheetHeader>
              <SheetTitle>Gestion du contrat</SheetTitle>
              <SheetDescription>Détails et état du véhicule.</SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-grow pr-6"><RentalForm key={rentalForModal?.id || 'new'} rental={rentalForModal} clients={clients} cars={cars} rentals={rentals} mode={formMode} onFinished={() => setIsSheetOpen(false)} /></ScrollArea>
        </SheetContent>
      </Sheet>
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        {rentalForModal && (
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Détails du contrat #{rentalForModal.contractNumber}</DialogTitle>
                    <DialogDescription>Informations et inspections.</DialogDescription>
                </DialogHeader>
                <RentalDetails rental={rentalForModal} />
                <DialogFooter className="no-print"><Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4"/>Imprimer</Button></DialogFooter>
            </DialogContent>
        )}
      </Dialog>
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Supprimer ?</AlertDialogTitle>
                <AlertDialogDescription>Action irréversible.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteRental(rentalForModal!)} className="bg-destructive">Supprimer</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
