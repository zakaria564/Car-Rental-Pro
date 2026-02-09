"use client";

import * as React from "react";
import Image from "next/image";
import { Wrench, Pencil, FileText, TriangleAlert, Gauge, Fuel, Cog, Construction, Printer, Trash2, Car as CarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Car, Maintenance } from "@/lib/definitions";
import { formatCurrency, cn, getSafeDate } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import CarForm from "./car-form";
import MaintenanceForm from "./maintenance-form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { useFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { differenceInDays, format } from "date-fns";
import { CarDetails, PrintableCarDetails } from "./car-details-view";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";


const getAvailabilityProps = (car: Car) => {
    switch (car.disponibilite) {
        case 'disponible':
            return { text: 'Disponible', className: 'bg-green-600' };
        case 'louee':
            return { text: 'Louée', className: 'bg-destructive' };
        case 'maintenance':
            return { text: 'En maintenance', className: 'bg-yellow-500' };
        default:
            return { text: 'Inconnu', className: 'bg-gray-500' };
    }
};

export default function CarCard({ car }: { car: Car }) {
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = React.useState(false);
  const [isMaintenanceSheetOpen, setIsMaintenanceSheetOpen] = React.useState(false);
  const [historyFilterDate, setHistoryFilterDate] = React.useState<Date | undefined>();
  const [isArchiveAlertOpen, setIsArchiveAlertOpen] = React.useState(false);

  const { toast } = useToast();
  const { firestore } = useFirebase();
  const availability = getAvailabilityProps(car);
  
  const handleArchiveCar = async () => {
    if (!firestore || !car) return;

    if (car.disponibilite === 'louee') {
        toast({
            variant: "destructive",
            title: "Action impossible",
            description: "Vous ne pouvez pas archiver une voiture actuellement en location.",
        });
        return;
    }

    const carRef = doc(firestore, "cars", car.id);
    const archivedCarRef = doc(firestore, "archived_cars", car.id);

    try {
        const batch = writeBatch(firestore);

        const carSnap = await getDoc(carRef);
        if (!carSnap.exists()) {
            toast({
                variant: "destructive",
                title: "Erreur",
                description: "La voiture n'a pas été trouvée.",
            });
            return;
        }
        
        const carData = carSnap.data();

        batch.set(archivedCarRef, carData);
        batch.delete(carRef);

        await batch.commit();

        toast({
            title: "Voiture archivée",
            description: `${car.marque} ${car.modele} a été déplacée vers les archives.`,
        });

    } catch (serverError: any) {
         const permissionError = new FirestorePermissionError({
            path: carRef.path,
            operation: 'delete',
        }, serverError as Error);
        errorEmitter.emit('permission-error', permissionError);

        toast({
            variant: "destructive",
            title: "Erreur d'archivage",
            description: "Impossible d'archiver la voiture. Vérifiez vos permissions.",
        });
    } finally {
      setIsArchiveAlertOpen(false);
    }
  }

  const groupedMaintenanceHistory = React.useMemo(() => {
    if (!car.maintenanceHistory || car.maintenanceHistory.length === 0) {
        return [];
    }

    const sortedHistory = [...car.maintenanceHistory].sort((a, b) => {
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
            groups[dateKey] = {
                date: eventDate,
                kilometrage: event.kilometrage,
                events: [],
                totalCost: 0
            };
        }
        groups[dateKey].events.push(event);
        groups[dateKey].totalCost += event.cout ?? 0;
    });

    return Object.values(groups);
  }, [car.maintenanceHistory]);

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

  const { documentAttention, maintenanceAttention } = React.useMemo(() => {
    const today = new Date();
    const docInfo = { needsAttention: false, message: "" };
    const maintInfo = { needsAttention: false, message: "" };

    const assuranceDate = getSafeDate(car.dateExpirationAssurance);
    if (assuranceDate) {
      const daysDiff = differenceInDays(assuranceDate, today);
      if (daysDiff < 0) {
        docInfo.needsAttention = true;
        docInfo.message = "Assurance expirée.";
      } else if (daysDiff <= 7) {
        docInfo.needsAttention = true;
        docInfo.message = "Assurance expire bientôt.";
      }
    }
    const visiteDate = getSafeDate(car.dateProchaineVisiteTechnique);
    if (visiteDate) {
      const daysDiff = differenceInDays(visiteDate, today);
      if (daysDiff < 0) {
        docInfo.needsAttention = true;
        docInfo.message = docInfo.message ? docInfo.message + " Visite technique expirée." : "Visite technique expirée.";
      } else if (daysDiff <= 7) {
        docInfo.needsAttention = true;
        docInfo.message = docInfo.message ? docInfo.message + " Visite technique expire bientôt." : "Visite technique expire bientôt.";
      }
    }

    const { kilometrage, maintenanceSchedule } = car;
    if (maintenanceSchedule) {
        const messages: string[] = [];
        const checkMaintAlert = (nextKm: number | undefined, type: string, soonThreshold: number) => {
             if (typeof nextKm !== 'number' || nextKm <= 0) return;
             const diff = nextKm - kilometrage;
             if (diff <= 0) {
                 messages.push(`${type} requise.`);
             } else if (diff <= soonThreshold) {
                 messages.push(`${type} bientôt.`);
             }
        }
        
        checkMaintAlert(maintenanceSchedule.prochainVidangeKm, "Vidange", 1000);
        checkMaintAlert(maintenanceSchedule.prochainFiltreGasoilKm, "Filtre gazole", 2000);
        checkMaintAlert(maintenanceSchedule.prochainesPlaquettesFreinKm, "Plaquettes", 2000);
        checkMaintAlert(maintenanceSchedule.prochaineCourroieDistributionKm, "Distribution", 5000);
        
        if (messages.length > 0) {
            maintInfo.needsAttention = true;
            maintInfo.message = messages.join(' ');
        }
    }

    return { documentAttention: docInfo, maintenanceAttention: maintInfo };
  }, [car]);

  const handlePrint = () => {
    const printContent = document.getElementById(`printable-details-${car.id}`);
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

  return (
    <Card className="relative flex flex-col sm:flex-row overflow-hidden group w-full">
        <div className="absolute top-2 right-2 z-10 p-1 flex gap-1">
            {documentAttention.needsAttention && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="p-1 rounded-full bg-background/80 backdrop-blur-sm">
                                <TriangleAlert className="h-5 w-5 text-destructive" />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent><p>{documentAttention.message}</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
             {maintenanceAttention.needsAttention && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                             <div className="p-1 rounded-full bg-background/80 backdrop-blur-sm">
                                <Wrench className="h-5 w-5 text-blue-500" />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent><p>{maintenanceAttention.message}</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
      <div className="relative w-full sm:w-1/3 h-48 sm:h-auto bg-muted">
        <div className="absolute top-2 left-2 z-10">
           <Badge className={cn(availability.className, "text-white")}>{availability.text}</Badge>
        </div>
        {car.photoURL && car.photoURL.startsWith('http') ? (
            <Image
                src={car.photoURL}
                alt={`${car.marque} ${car.modele}`}
                fill
                className="object-contain"
                data-ai-hint="car photo"
            />
        ) : (
            <div className="flex items-center justify-center h-full">
                <CarIcon className="w-16 h-16 text-muted-foreground" />
            </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-grow w-full sm:w-2/3">
        <div className="flex-grow">
          <h3 className="text-lg font-bold truncate">{car.marque} {car.modele}</h3>
          <p className="text-sm text-muted-foreground">{car.immat}</p>
          <div className="mt-2 flex flex-wrap items-center text-xs text-muted-foreground gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <Gauge className="h-4 w-4" />
                <span>{car.kilometrage.toLocaleString()} km</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Fuel className="h-4 w-4" />
                <span>{car.carburantType}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Cog className="h-4 w-4" />
                <span>{car.transmission}</span>
              </span>
          </div>
        </div>
        <div className="mt-4">
          <div className="font-bold text-xl mb-4">{formatCurrency(car.prixParJour, 'MAD')}<span className="text-xs font-normal text-muted-foreground">/jour</span></div>
          
            <TooltipProvider>
                <div className="w-full flex justify-start items-center gap-1">
                    <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-9 w-9">
                                        <FileText className="h-4 w-4" />
                                    </Button>
                                </DialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Voir détails et historique d'entretien</p></TooltipContent>
                        </Tooltip>
                        <DialogContent className="sm:max-w-lg">
                            <DialogHeader className="no-print">
                                <DialogTitle>Détails du véhicule</DialogTitle>
                                <DialogDescription>{car.marque} {car.modele} - {car.immat}</DialogDescription>
                            </DialogHeader>
                            <div className="hidden">
                                <PrintableCarDetails car={car} history={filteredHistory} />
                            </div>
                            <CarDetails 
                                car={car} 
                                groupedMaintenanceHistory={groupedMaintenanceHistory}
                                filteredHistory={filteredHistory}
                                historyFilterDate={historyFilterDate}
                                setHistoryFilterDate={setHistoryFilterDate}
                            />
                            <DialogFooter className="no-print">
                                <Button variant="outline" onClick={handlePrint}>
                                    <Printer className="mr-2 h-4 w-4"/>
                                    Imprimer l'historique
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <SheetTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-9 w-9" disabled={car.disponibilite === 'louee'}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                </SheetTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Modifier</p></TooltipContent>
                        </Tooltip>
                         <SheetContent className="sm:max-w-[480px]">
                            <SheetHeader><SheetTitle>Modifier la voiture</SheetTitle></SheetHeader>
                            <ScrollArea className="h-full pr-6">
                                <CarForm car={car} onFinished={() => setIsSheetOpen(false)} />
                            </ScrollArea>
                        </SheetContent>
                    </Sheet>

                    <Sheet open={isMaintenanceSheetOpen} onOpenChange={setIsMaintenanceSheetOpen}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <SheetTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-9 w-9" disabled={car.disponibilite === 'louee'}>
                                        <Construction className="h-4 w-4" />
                                    </Button>
                                </SheetTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{car.disponibilite === 'maintenance' ? 'Terminer la maintenance' : 'Mettre en maintenance'}</p>
                            </TooltipContent>
                        </Tooltip>
                        <SheetContent className="sm:max-w-md">
                            <SheetHeader>
                                <SheetTitle>{car.disponibilite === 'maintenance' ? 'Terminer la maintenance' : 'Mettre en maintenance'}</SheetTitle>
                            </SheetHeader>
                             <ScrollArea className="h-full pr-6">
                                <MaintenanceForm car={car} onFinished={() => setIsMaintenanceSheetOpen(false)} />
                            </ScrollArea>
                        </SheetContent>
                    </Sheet>
                    
                    <AlertDialog open={isArchiveAlertOpen} onOpenChange={setIsArchiveAlertOpen}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                     <Button variant="outline" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={car.disponibilite === 'louee'}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Archiver le véhicule</p></TooltipContent>
                        </Tooltip>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Archiver ce véhicule ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Cette action retirera le véhicule de votre flotte active et le déplacera dans les archives. Il ne sera plus disponible à la location, mais son historique sera conservé. Êtes-vous sûr de vouloir continuer ?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={handleArchiveCar} className="bg-destructive hover:bg-destructive/90">
                                    Archiver
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                </div>
            </TooltipProvider>

        </div>
      </div>
    </Card>
  );
}
