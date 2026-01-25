

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
            <div>
                <Skeleton className="h-4 w-24 mb-2" />
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
        <div>
            <h4 className="font-semibold">{inspection.type === 'depart' ? 'Livraison (Départ)' : 'Réception (Retour)'}</h4>
            <p><strong>Date:</strong> {safeInspectionDate}</p>
            <p><strong>Kilométrage:</strong> {inspection.kilometrage.toLocaleString()} km</p>
            <p><strong>Niveau Carburant:</strong> {inspection.carburantNiveau * 100}%</p>
            {inspection.notes && <p><strong>Notes:</strong> {inspection.notes}</p>}
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
            <div className="mt-2">
                <strong className="block mb-1 font-semibold">Schéma des dommages:</strong>
                <div className="printable-diagram-wrapper">
                    <CarDamageDiagram damages={damagesForDiagram} onDamagesChange={() => {}} readOnly showLegend={false} />
                </div>
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
        <div>
            <h4 className="font-semibold">{type === 'depart' ? 'Livraison (Départ)' : 'Réception (Retour)'}</h4>
            <p><strong>Date:</strong> {safeDate}</p>
            <p><strong>Kilométrage:</strong> {data.kilometrage?.toLocaleString()} km</p>
            <p><strong>Niveau Carburant:</strong> {data.carburantNiveau ? data.carburantNiveau * 100 + '%' : 'N/A'}</p>
            {data.dommagesNotes && <p><strong>Notes:</strong> {data.dommagesNotes}</p>}
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
            <div className="mt-2">
                <strong className="block mb-1 font-semibold">Schéma des dommages:</strong>
                <div className="printable-diagram-wrapper">
                    <CarDamageDiagram damages={data.damages || {}} onDamagesChange={() => {}} readOnly showLegend={false} />
                </div>
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
        return isNaN(parsed.getTime()) ? undefined : parsed;
    };

    const safeDebutDate = getSafeDate(rental.location.dateDebut);
    const safeFinDate = getSafeDate(rental.location.dateFin);

    return (
      <ScrollArea className="h-[70vh]">
        <div className="text-sm p-2" id="printable-contract">
          <div className="contract-body">
            {/* Header */}
            <div className="text-center mb-4">
                <h2 className="text-2xl font-bold tracking-wider">CONTRAT DE LOCATION DE VÉHICULE</h2>
                <p className="text-muted-foreground">Contrat N°: {rental.id?.substring(0, 8).toUpperCase()}</p>
            </div>
            
            <div className="space-y-4">
              {/* Parties */}
              <div className="border p-3 rounded-md space-y-3">
                  <h3 className="font-bold text-base underline">LES PARTIES</h3>
                   <div>
                      <h4 className="font-semibold">Le Loueur :</h4>
                      <p>Location Auto Pro</p>
                      <p>Agdal, Rabat, Maroc</p>
                      <p>Tél: +212 537 00 00 00</p>
                  </div>
                  <div>
                      <h4 className="font-semibold">Le Locataire (Conducteur Principal) :</h4>
                      <p><strong>Nom:</strong> {rental.locataire.nomPrenom}</p>
                      <p><strong>CIN/Passeport:</strong> {rental.locataire.cin}</p>
                      <p><strong>Permis N°:</strong> {rental.locataire.permisNo}</p>
                      <p><strong>Téléphone:</strong> {rental.locataire.telephone}</p>
                  </div>
                  {rental.conducteur2 && (
                  <div className="mt-2">
                      <h4 className="font-semibold">Deuxième Conducteur :</h4>
                      <p><strong>Nom:</strong> {rental.conducteur2.nomPrenom}</p>
                      <p><strong>CIN/Passeport:</strong> {rental.conducteur2.cin}</p>
                      <p><strong>Permis N°:</strong> {rental.conducteur2.permisNo}</p>
                  </div>
                  )}
              </div>


              {/* Vehicle & Conditions */}
              <div className="border p-3 rounded-md space-y-3">
                  <h3 className="font-bold text-base underline">DÉTAILS DE LA LOCATION</h3>
                   <div className="space-y-1">
                      <h4 className="font-semibold">Véhicule Loué :</h4>
                      <p><strong>Marque/Modèle:</strong> {rental.vehicule.marque}</p>
                      <p><strong>Immatriculation:</strong> {rental.vehicule.immatriculation}</p>
                      <p><strong>Carburant:</strong> {rental.vehicule.carburantType}</p>
                      <p><strong>Transmission:</strong> {rental.vehicule.transmission}</p>
                  </div>
                  <div className="space-y-1">
                      <h4 className="font-semibold">Période & Coût :</h4>
                      <p><strong>Début:</strong> {safeDebutDate ? format(safeDebutDate, "dd/MM/yy 'à' HH:mm", { locale: fr }) : 'N/A'}</p>
                      <p><strong>Fin Prévue:</strong> {safeFinDate ? format(safeFinDate, "dd/MM/yy 'à' HH:mm", { locale: fr }) : 'N/A'}</p>
                      <p><strong>Durée:</strong> {rental.location.nbrJours} jour(s)</p>
                      <p><strong>Dépôt de Caution:</strong> {formatCurrency(rental.location.depot || 0, 'MAD')}</p>
                      <p><strong>Prix Total:</strong> {formatCurrency(rental.location.montantAPayer, 'MAD')}</p>
                  </div>
              </div>

              {/* Delivery / Return state */}
              <div className="border p-3 rounded-md">
                  <h3 className="font-bold text-base mb-2 underline">ÉTAT DU VÉHICULE</h3>
                  <div className="space-y-4">
                      {rental.livraisonInspectionId ? (
                          <InspectionDetailsView inspectionId={rental.livraisonInspectionId} />
                      ) : (
                          <OldInspectionDetailsView data={rental.livraison} type="depart" />
                      )}

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
            <div className="signatures-section">
                <div className="grid grid-cols-2 gap-16">
                    <div className="text-center">
                        <p className="border-t pt-2">Signature du Loueur</p>
                        <p className="text-xs text-muted-foreground">(Précédée de la mention "Lu et approuvé")</p>
                    </div>
                     <div className="text-center">
                        <p className="border-t pt-2">Signature du Locataire</p>
                        <p className="text-xs text-muted-foreground">(Précédée de la mention "Lu et approuvé")</p>
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
        margin: 8mm;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: white;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body {
        font-family: Arial, sans-serif;
      }
      .no-print { display: none !important; }

      #printable-contract {
        display: flex;
        flex-direction: column;
        height: calc(297mm - 16mm); /* A4 height minus margins */
        font-size: 8pt;
        line-height: 1.3;
      }
       #printable-contract .contract-body {
        flex-grow: 1;
      }
       #printable-contract .signatures-section {
        margin-top: auto;
        padding-top: 5mm;
      }
      
      #printable-contract .contract-body > div,
      #printable-contract .contract-body .space-y-4 > div {
        margin-bottom: 2mm;
        break-inside: avoid;
      }
      #printable-contract p { margin: 0.3mm 0; }
      #printable-contract h2, #printable-contract h3, #printable-contract h4 { margin: 0 0 1mm 0; padding: 0; font-weight: bold; }
      #printable-contract strong { font-weight: bold; }
      #printable-contract .text-sm { font-size: 8pt; line-height: 1.3; }
      #printable-contract .p-3 { padding: 2mm; }
      #printable-contract .text-center { text-align: center; }
      #printable-contract .mb-4 { margin-bottom: 3mm; }
      #printable-contract .text-2xl { font-size: 14pt; }
      #printable-contract .tracking-wider { letter-spacing: 0.05em; }
      #printable-contract .text-muted-foreground { color: #555; }
      #printable-contract .border { border: 0.5pt solid #ccc; }
      #printable-contract .rounded-md { border-radius: 3px; }
      #printable-contract .mb-2 { margin-bottom: 1mm; }
      #printable-contract .underline { text-decoration: underline; }
      #printable-contract .font-semibold { font-weight: 600; }
      #printable-contract .text-base { font-size: 9pt; }
      
      #printable-contract .gap-16 { gap: 20mm; }
      #printable-contract .border-t { border-top: 0.5pt solid #ccc; }
      #printable-contract .pt-2 { padding-top: 2mm; }
      #printable-contract .text-xs { font-size: 7pt; }
      #printable-contract .list-disc { list-style-type: disc; }
      #printable-contract .list-inside { list-style-position: inside; }
      #printable-contract .mt-2 { margin-top: 2mm; }
      #printable-contract .block { display: block; }
      #printable-contract .mb-1 { margin-bottom: 1mm; }
      
      #printable-contract .printable-diagram-wrapper { padding: 1mm 0; text-align: center; }
      #printable-contract .printable-diagram-wrapper > div { max-width: 150px !important; margin: 0 auto; display: inline-block; }
      #printable-contract .printable-diagram-wrapper svg { max-width: 100% !important; height: auto !important; }
      
      #printable-contract *, #printable-contract *::before, #printable-contract *::after {
        break-inside: avoid !important;
      }
    `;

    printWindow.document.write('<html><head><title>Contrat de Location</title>');
    printWindow.document.write(`<style>${styles}</style>`);
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

    






