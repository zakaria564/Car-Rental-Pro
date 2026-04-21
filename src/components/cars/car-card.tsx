"use client";

import * as React from "react";
import Image from "next/image";
import { Pencil, FileText, TriangleAlert, Gauge, Fuel, Cog, Trash2, Car as CarIcon, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Car } from "@/lib/definitions";
import { formatCurrency, cn, getSafeDate } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import CarForm from "./car-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { useFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { differenceInDays, format } from "date-fns";
import { CarDetails } from "./car-details-view";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

const getAvailabilityProps = (car: Car) => {
    switch (car.disponibilite) {
        case 'disponible': return { text: 'Disponible', className: 'bg-green-600' };
        case 'louee': return { text: 'Louée', className: 'bg-destructive' };
        case 'maintenance': return { text: 'En maintenance', className: 'bg-yellow-500' };
        default: return { text: 'Inconnu', className: 'bg-gray-500' };
    }
};

export default function CarCard({ car }: { car: Car }) {
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = React.useState(false);
  const [historyFilterDate, setHistoryFilterDate] = React.useState<Date | undefined>();
  const [isArchiveAlertOpen, setIsArchiveAlertOpen] = React.useState(false);

  const { toast } = useToast();
  const { firestore } = useFirebase();
  const availability = getAvailabilityProps(car);
  
  const handleArchiveCar = async () => {
    if (!firestore || !car) return;
    if (car.disponibilite === 'louee') {
        toast({ variant: "destructive", title: "Action impossible", description: "Vous ne pouvez pas archiver une voiture en location." });
        return;
    }
    const carRef = doc(firestore, "cars", car.id);
    const archivedCarRef = doc(firestore, "archived_cars", car.id);
    try {
        const batch = writeBatch(firestore);
        const carSnap = await getDoc(carRef);
        if (!carSnap.exists()) return;
        batch.set(archivedCarRef, carSnap.data());
        batch.delete(carRef);
        await batch.commit();
        toast({ title: "Voiture archivée", description: "Le véhicule a été déplacé vers les archives." });
    } catch (serverError: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: carRef.path, operation: 'delete' }, serverError as Error));
    } finally { setIsArchiveAlertOpen(false); }
  }

  const groupedMaintenanceHistory = React.useMemo(() => {
    if (!car.maintenanceHistory || car.maintenanceHistory.length === 0) return [];
    const sortedHistory = [...car.maintenanceHistory].sort((a, b) => (getSafeDate(b.date)?.getTime() || 0) - (getSafeDate(a.date)?.getTime() || 0));
    const groups: { [key: string]: any } = {};
    sortedHistory.forEach(event => {
        const eventDate = getSafeDate(event.date);
        if (!eventDate) return;
        const dateKey = format(eventDate, 'yyyy-MM-dd');
        if (!groups[dateKey]) groups[dateKey] = { date: eventDate, kilometrage: event.kilometrage, events: [], totalCost: 0 };
        groups[dateKey].events.push(event);
        groups[dateKey].totalCost += event.cout ?? 0;
    });
    return Object.values(groups);
  }, [car.maintenanceHistory]);

  const filteredHistory = React.useMemo(() => {
    if (!historyFilterDate) return groupedMaintenanceHistory;
    const filterDateStr = format(historyFilterDate, 'yyyy-MM-dd');
    return groupedMaintenanceHistory.filter((group: any) => format(group.date, 'yyyy-MM-dd') === filterDateStr);
  }, [groupedMaintenanceHistory, historyFilterDate]);

  const { documentAttention } = React.useMemo(() => {
    const today = new Date();
    let hasExpired = false, hasSoon = false, docMessages: string[] = [];
    const checkDoc = (date: any, name: string) => {
      const d = getSafeDate(date);
      if (!d) return;
      const diff = differenceInDays(d, today);
      if (diff < 0) { hasExpired = true; docMessages.push(`${name} exp.`); }
      else if (diff <= 7) { hasSoon = true; docMessages.push(`${name} bientôt.`); }
    };
    checkDoc(car.dateExpirationAssurance, "Assurance");
    checkDoc(car.dateProchaineVisiteTechnique, "Visite");
    return { documentAttention: { needsAttention: hasExpired || hasSoon, message: docMessages.join(' '), status: hasExpired ? 'expired' : 'soon' } };
  }, [car]);

  return (
    <Card className="relative flex flex-col sm:flex-row overflow-hidden group w-full">
      <div className="relative w-full sm:w-1/3 h-48 sm:h-auto bg-muted shrink-0">
        <div className="absolute top-2 left-2 z-10">
           <Badge className={cn(availability.className, "text-white")}>{availability.text}</Badge>
        </div>
        {car.photoURL ? (
            <a href={car.photoURL} target="_blank" rel="noopener noreferrer" className="block w-full h-full relative cursor-zoom-in group/img">
                <Image
                    src={car.photoURL}
                    alt={`${car.marque} ${car.modele}`}
                    fill
                    className="object-contain"
                    unoptimized
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                    <ExternalLink className="text-white h-6 w-6" />
                </div>
            </a>
        ) : (
            <div className="flex items-center justify-center h-full">
                <CarIcon className="w-16 h-16 text-muted-foreground" />
            </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-grow w-full sm:w-2/3">
        <div className="flex-grow">
          <div className="flex justify-between items-start gap-2 mb-1">
            <div className="min-w-0">
              <h3 className="text-lg font-bold truncate">{car.marque} {car.modele}</h3>
              <p className="text-sm text-muted-foreground">{car.immat}</p>
            </div>
            <div className="flex gap-1 shrink-0">
                {documentAttention.needsAttention && (
                    <TooltipProvider><Tooltip><TooltipTrigger asChild><div className={cn("p-1 rounded-full", documentAttention.status === 'expired' ? "bg-destructive/10" : "bg-amber-100")}><TriangleAlert className={cn("h-5 w-5", documentAttention.status === 'expired' ? "text-destructive" : "text-amber-500")} /></div></TooltipTrigger><TooltipContent><p>{documentAttention.message}</p></TooltipContent></Tooltip></TooltipProvider>
                )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center text-xs text-muted-foreground gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5"><Gauge className="h-4 w-4" /><span>{car.kilometrage.toLocaleString()} km</span></span>
              <span className="inline-flex items-center gap-1.5"><Fuel className="h-4 w-4" /><span>{car.carburantType}</span></span>
              <span className="inline-flex items-center gap-1.5"><Cog className="h-4 w-4" /><span>{car.transmission}</span></span>
          </div>
        </div>
        <div className="mt-4">
          <div className="font-bold text-xl mb-4">{formatCurrency(car.prixParJour, 'MAD')}<span className="text-xs font-normal text-muted-foreground">/jour</span></div>
          <div className="flex justify-start gap-1">
            <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
                <TooltipProvider><Tooltip><TooltipTrigger asChild><DialogTrigger asChild><Button variant="outline" size="icon"><FileText className="h-4 w-4" /></Button></DialogTrigger></TooltipTrigger><TooltipContent><p>Détails & Entretien</p></TooltipContent></Tooltip></TooltipProvider>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Détails du véhicule</DialogTitle>
                        <DialogDescription>{car.marque} {car.modele} - {car.immat}</DialogDescription>
                    </DialogHeader>
                    <CarDetails car={car} groupedMaintenanceHistory={groupedMaintenanceHistory} filteredHistory={filteredHistory} historyFilterDate={historyFilterDate} setHistoryFilterDate={setHistoryFilterDate} />
                </DialogContent>
            </Dialog>
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild><Button variant="outline" size="icon" disabled={car.disponibilite === 'louee'}><Pencil className="h-4 w-4" /></Button></SheetTrigger>
                <SheetContent className="sm:max-w-[480px]">
                    <SheetHeader>
                        <SheetTitle>Modifier le véhicule</SheetTitle>
                        <SheetDescription>{car.marque} {car.modele} ({car.immat})</SheetDescription>
                    </SheetHeader>
                    <ScrollArea className="h-full pr-6">
                        <CarForm car={car} onFinished={() => setIsSheetOpen(false)} />
                    </ScrollArea>
                </SheetContent>
            </Sheet>
            <AlertDialog open={isArchiveAlertOpen} onOpenChange={setIsArchiveAlertOpen}>
                <AlertDialogTrigger asChild><Button variant="outline" size="icon" className="text-destructive" disabled={car.disponibilite === 'louee'}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Archiver ce véhicule ?</AlertDialogTitle>
                        <AlertDialogDescription>Le véhicule sera déplacé vers les archives et ne sera plus visible dans la flotte active.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleArchiveCar} className="bg-destructive">Archiver</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </Card>
  );
}
