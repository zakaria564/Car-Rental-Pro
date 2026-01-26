
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
import type { Rental, Client, Car, DamageType, Inspection, Damage } from "@/lib/definitions";
import { damageTypes } from "@/lib/definitions";
import { formatCurrency, cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import RentalForm from "./rental-form";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription as DialogDesc, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import Image from "next/image";
import { ScrollArea } from "../ui/scroll-area";
import { doc, deleteDoc, updateDoc, writeBatch, getDoc, collection, getDocs } from "firebase/firestore";
import { useFirebase } from "@/firebase";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import CarDamageDiagram, { carParts } from "./car-damage-diagram";
import { Skeleton } from "../ui/skeleton";

type RentalTableProps = {
  rentals: Rental[];
  clients?: Client[];
  cars?: Car[];
  isDashboard?: boolean;
};

const InspectionDetailsView: React.FC<{ inspectionId: string }> = ({ inspectionId }) => {
    const [inspection, setInspection] = React.useState<Inspection | null>(null);
    const [loading, setLoading] = React.useState(true);
    const { firestore } = useFirebase();

    React.useEffect(() => {
        if (!firestore || !inspectionId) return;
        
        const fetchInspection = async () => {
            setLoading(true);
            try {
                const inspectionRef = doc(firestore, 'inspections', inspectionId);
                const inspectionSnap = await getDoc(inspectionRef);

                if (inspectionSnap.exists()) {
                    const inspectionData = inspectionSnap.data() as Omit<Inspection, 'id' | 'damages'>;
                    const damagesRef = collection(firestore, `inspections/${inspectionId}/damages`);
                    const damagesSnap = await getDocs(damagesRef);
                    const damages = damagesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Damage));
                    
                    setInspection({ ...inspectionData, id: inspectionSnap.id, damages });
                }
            } catch (error) {
                console.error("Failed to fetch inspection details:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchInspection();
    }, [firestore, inspectionId]);
    
    const damagesForDiagram = React.useMemo(() => {
        if (!inspection?.damages) return {};
        return inspection.damages.reduce((acc, damage) => {
            if (damage.partName) {
                acc[damage.partName as keyof typeof acc] = damage.damageType;
            }
            return acc;
        }, {} as { [key: string]: DamageType });
    }, [inspection?.damages]);


    if (loading) {
        return (
            <div className="space-y-2">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-40 w-full mt-2" />
            </div>
        );
    }

    if (!inspection) {
        return <p>Détails de l'inspection non trouvés.</p>;
    }
    
    const damageEntries = Object.entries(damagesForDiagram);
    const safeInspectionDate = inspection.timestamp?.toDate ? format(inspection.timestamp.toDate(), "dd/MM/yyyy HH:mm", { locale: fr }) : 'N/A';

    return (
        <div className="space-y-2">
            <h4 className="font-bold text-base">{inspection.type === 'depart' ? 'Livraison (Départ)' : 'Réception (Retour)'}</h4>
            <div className="space-y-1">
                <div className="flex justify-between"><span><strong>Date:</strong></span> <span>{safeInspectionDate}</span></div>
                <div className="flex justify-between"><span><strong>Kilométrage:</strong></span> <span>{inspection.kilometrage.toLocaleString()} km</span></div>
                <div className="flex justify-between"><span><strong>Niveau Carburant:</strong></span> <span>{inspection.carburantNiveau * 100}%</span></div>
            </div>

            {inspection.notes && <p className="text-xs italic mt-1"><strong>Notes:</strong> {inspection.notes}</p>}
            
            {damageEntries.length > 0 && (
                <div className="mt-2 text-xs">
                    <strong>Dommages constatés:</strong>
                    <ul className="list-disc list-inside">
                        {damageEntries.map(([partId, damageType]) => {
                           const part = carParts.find(p => p.id === partId);
                           const damage = damageTypes[damageType as DamageType];
                           if (!part || !damage) return null;
                           return ( <li key={partId}>{part.label}: {damage.label}</li> )
                        })}
                    </ul>
                </div>
            )}
            <div className="mt-2 printable-diagram-wrapper print:hidden">
                <strong className="block mb-1 font-semibold">Schéma des dommages:</strong>
                <CarDamageDiagram damages={damagesForDiagram} onDamagesChange={() => {}} readOnly showLegend={false} />
            </div>
        </div>
    );
};

const OldInspectionDetailsView: React.FC<{
    data: Rental['livraison'] | Rental['reception'],
    type: 'depart' | 'retour'
}> = ({ data, type }) => {
    if (!data) return type === 'retour' ? <p>Véhicule non retourné.</p> : null;

    const safeDate = data.dateHeure?.toDate ? format(data.dateHeure.toDate(), "dd/MM/yyyy HH:mm", { locale: fr }) : 'N/A';
    const damageEntries = Object.entries(data.damages || {});

    return (
        <div className="space-y-2">
            <h4 className="font-bold text-base">{type === 'depart' ? 'Livraison (Départ)' : 'Réception (Retour)'}</h4>
            <div className="space-y-1">
                <div className="flex justify-between"><span><strong>Date:</strong></span> <span>{safeDate}</span></div>
                <div className="flex justify-between"><span><strong>Kilométrage:</strong></span> <span>{data.kilometrage?.toLocaleString()} km</span></div>
                <div className="flex justify-between"><span><strong>Niveau Carburant:</strong></span> <span>{data.carburantNiveau ? data.carburantNiveau * 100 + '%' : 'N/A'}</span></div>
            </div>
            {data.dommagesNotes && <p className="text-xs italic mt-1"><strong>Notes:</strong> {data.dommagesNotes}</p>}

            {damageEntries.length > 0 && (
                <div className="mt-2 text-xs">
                    <strong>Dommages constatés:</strong>
                    <ul className="list-disc list-inside">
                        {damageEntries.map(([partId, damageType]) => {
                            const part = carParts.find(p => p.id === partId);
                            const damage = damageTypes[damageType as DamageType];
                            if (!part || !damage) return null;
                            return ( <li key={partId}>{part.label}: {damage.label}</li> )
                        })}
                    </ul>
                </div>
            )}
            <div className="mt-2 printable-diagram-wrapper print:hidden">
                <strong className="block mb-1 font-semibold">Schéma des dommages:</strong>
                <CarDamageDiagram damages={data.damages || {}} onDamagesChange={() => {}} readOnly showLegend={false} />
            </div>
        </div>
    );
};

function RentalDetails({ rental }: { rental: Rental }) {
    const getSafeDate = (date: any): Date | undefined => {
        if (!date) return undefined;
        if (date instanceof Date) return date;
        if (date.toDate && typeof date.toDate === 'function') return date.toDate();
        const parsed = new Date(date);
        return isNaN(parsed.getTime()) ? undefined : getSafeDate(date);
    };

    const safeDebutDate = getSafeDate(rental.location.dateDebut);
    const safeFinDate = getSafeDate(rental.location.dateFin);

    return (
      <ScrollArea className="h-[70vh]">
        <div className="text-sm p-2" id="printable-contract">
          <div className="contract-body flex flex-col h-full">
            {/* Header */}
            <div className="text-center mb-4 print:text-center">
                <h2 className="text-2xl font-bold tracking-wider">CONTRAT DE LOCATION DE VÉHICULE</h2>
                <p className="text-muted-foreground">Contrat N°: {rental.id?.substring(0, 8).toUpperCase()}</p>
            </div>
            
            <div className="space-y-4 flex-grow">
                 <div className="border p-3 rounded-md">
                    <h3 className="font-bold text-base underline mb-2">LES PARTIES</h3>
                    <div className="space-y-2 md:space-y-0 print:grid print:grid-cols-2 print:gap-x-4">
                         <div className="space-y-1">
                            <h4 className="font-semibold">Le Loueur :</h4>
                            <p>Location Auto Pro</p>
                            <p>Agdal, Rabat, Maroc</p>
                            <p>Tél: +212 537 00 00 00</p>
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-semibold">Le Locataire (Conducteur Principal) :</h4>
                            <div className="flex justify-between"><span><strong>Nom:</strong></span> <span>{rental.locataire.nomPrenom}</span></div>
                            <div className="flex justify-between"><span><strong>CIN/Passeport:</strong></span> <span>{rental.locataire.cin}</span></div>
                            <div className="flex justify-between"><span><strong>Permis N°:</strong></span> <span>{rental.locataire.permisNo}</span></div>
                            <div className="flex justify-between"><span><strong>Téléphone:</strong></span> <span>{rental.locataire.telephone}</span></div>
                        </div>
                        {rental.conducteur2 && (
                        <div className="mt-2 pt-2 border-t md:border-t-0 md:pt-0">
                            <h4 className="font-semibold">Deuxième Conducteur :</h4>
                            <div className="space-y-1">
                                <div className="flex justify-between"><span><strong>Nom:</strong></span> <span>{rental.conducteur2.nomPrenom}</span></div>
                                <div className="flex justify-between"><span><strong>CIN/Passeport:</strong></span> <span>{rental.conducteur2.cin}</span></div>
                                <div className="flex justify-between"><span><strong>Permis N°:</strong></span> <span>{rental.conducteur2.permisNo}</span></div>
                            </div>
                        </div>
                        )}
                    </div>
                </div>

                 <div className="border p-3 rounded-md">
                    <h3 className="font-bold text-base underline mb-2">DÉTAILS DE LA LOCATION</h3>
                    <div className="space-y-2 md:space-y-0 print:grid print:grid-cols-2 print:gap-x-4">
                         <div className="space-y-1">
                            <h4 className="font-semibold">Véhicule Loué :</h4>
                            <div className="flex justify-between"><span><strong>Marque/Modèle:</strong></span> <span>{rental.vehicule.marque}</span></div>
                            <div className="flex justify-between"><span><strong>Immatriculation:</strong></span> <span>{rental.vehicule.immatriculation}</span></div>
                            <div className="flex justify-between"><span><strong>Carburant:</strong></span> <span>{rental.vehicule.carburantType}</span></div>
                            <div className="flex justify-between"><span><strong>Transmission:</strong></span> <span>{rental.vehicule.transmission}</span></div>
                        </div>
                         <div className="space-y-1">
                            <h4 className="font-semibold">Période & Coût :</h4>
                            <div className="flex justify-between"><span><strong>Début:</strong></span> <span>{safeDebutDate ? format(safeDebutDate, "dd/MM/yy 'à' HH:mm", { locale: fr }) : 'N/A'}</span></div>
                            <div className="flex justify-between"><span><strong>Fin Prévue:</strong></span> <span>{safeFinDate ? format(safeFinDate, "dd/MM/yy 'à' HH:mm", { locale: fr }) : 'N/A'}</span></div>
                            <div className="flex justify-between"><span><strong>Durée:</strong></span> <span>{rental.location.nbrJours} jour(s)</span></div>
                            {rental.statut !== 'terminee' && (
                                <div className="flex justify-between"><span><strong>Dépôt de Caution:</strong></span> <span>{formatCurrency(rental.location.depot || 0, 'MAD')}</span></div>
                            )}
                            <div className="flex justify-between font-bold text-base mt-2 pt-2 border-t"><span>Prix Total:</span> <span>{formatCurrency(rental.location.montantAPayer, 'MAD')}</span></div>
                        </div>
                    </div>
                </div>

                <div className="border p-3 rounded-md">
                    <h3 className="font-bold text-base mb-2 underline">ÉTAT DU VÉHICULE</h3>
                    <div className="space-y-3 md:space-y-0 print:grid print:grid-cols-2 print:gap-x-4">
                        <div>
                            {rental.livraisonInspectionId ? (
                                <InspectionDetailsView inspectionId={rental.livraisonInspectionId} />
                            ) : (
                                <OldInspectionDetailsView data={rental.livraison} type="depart" />
                            )}
                        </div>
                        <div className="mt-4 md:mt-0">
                            {rental.receptionInspectionId ? (
                                <InspectionDetailsView inspectionId={rental.receptionInspectionId} />
                            ) : (
                                <OldInspectionDetailsView data={rental.reception} type="retour" />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Signatures */}
            <div className="signatures-section mt-auto pt-8 print:grid print:grid-cols-2 print:gap-16">
                <div className="text-center mt-8 md:mt-0">
                    <p className="border-t pt-2 print:pt-1 print:border-gray-400">Signature du Loueur</p>
                    <p className="text-xs text-muted-foreground print:text-[8pt]">(Précédée de la mention "Lu et approuvé")</p>
                </div>
                 <div className="text-center mt-8 md:mt-0">
                    <p className="border-t pt-2 print:pt-1 print:border-gray-400">Signature du Locataire</p>
                    <p className="text-xs text-muted-foreground print:text-[8pt]">(Précédée de la mention "Lu et approuvé")</p>
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
      @page {
        size: A4;
        margin: 15mm;
      }
      body {
        background: white !important;
        font-family: Arial, sans-serif;
        font-size: 9pt;
        line-height: 1.3;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .no-print { display: none !important; }
      .contract-body {
        display: flex;
        flex-direction: column;
        height: 100%;
      }
    `;

    printWindow.document.write('<html><head><title>Contrat de Location</title>');
    printWindow.document.write('<style>');
    printWindow.document.write(styles);
    printWindow.document.write('</style>');
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

    