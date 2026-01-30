"use client";

import * as React from "react";
import Image from "next/image";
import { Wrench, Pencil, Trash2, FileText, TriangleAlert, Gauge, Fuel, Cog } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Car, Maintenance } from "@/lib/definitions";
import { formatCurrency, cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import CarForm from "./car-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import { useFirebase } from "@/firebase";
import { deleteDoc, doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Separator } from "../ui/separator";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

const getSafeDate = (date: any): Date | null => {
    if (!date) return null;
    if (date instanceof Date && !isNaN(date.getTime())) return date;
    if (date.toDate) return date.toDate();
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) return null;
    return new Date(parsedDate.valueOf() + parsedDate.getTimezoneOffset() * 60 * 1000);
};

function CarDetails({ car }: { car: Car }) {
    const today = new Date();
    
    const assuranceDate = car.dateExpirationAssurance?.toDate ? car.dateExpirationAssurance.toDate() : null;
    const isAssuranceExpired = assuranceDate && assuranceDate < today;
    const daysUntilAssuranceExpires = assuranceDate ? differenceInDays(assuranceDate, today) : null;
    const isAssuranceExpiringSoon = !isAssuranceExpired && daysUntilAssuranceExpires !== null && daysUntilAssuranceExpires >= 0 && daysUntilAssuranceExpires <= 7;

    const visiteDate = car.dateProchaineVisiteTechnique?.toDate ? car.dateProchaineVisiteTechnique.toDate() : null;
    const isVisiteExpired = visiteDate && visiteDate < today;
    const daysUntilVisiteExpires = visiteDate ? differenceInDays(visiteDate, today) : null;
    const isVisiteExpiringSoon = !isVisiteExpired && daysUntilVisiteExpires !== null && daysUntilVisiteExpires >= 0 && daysUntilVisiteExpires <= 7;


    return (
        <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div><strong>Marque:</strong> {car.marque}</div>
                    <div><strong>Modèle:</strong> {car.modele}</div>
                    <div><strong>Mise en circulation:</strong> {car.dateMiseEnCirculation?.toDate ? format(car.dateMiseEnCirculation.toDate(), 'dd/MM/yyyy', { locale: fr }) : 'N/A'}</div>
                    <div><strong>Immatriculation:</strong> {car.immat}</div>
                    {car.immatWW && <div><strong>Immatriculation WW:</strong> {car.immatWW}</div>}
                    <div><strong>N° de châssis:</strong> {car.numChassis}</div>
                    <div><strong>Couleur:</strong> {car.couleur}</div>
                    <div><strong>Kilométrage:</strong> {car.kilometrage.toLocaleString()} km</div>
                    <div><strong>Carburant:</strong> {car.carburantType}</div>
                    <div><strong>Transmission:</strong> {car.transmission}</div>
                    <div><strong>Puissance:</strong> {car.puissance} cv</div>
                    <div><strong>Places:</strong> {car.nbrPlaces}</div>
                    <div><strong>État:</strong> {car.etat}</div>
                    <div className="flex items-center gap-2"><strong>Disponibilité:</strong> <Badge variant={car.disponible ? "default" : "destructive"} className={cn(car.disponible ? 'bg-green-600' : '')}>{car.disponible ? "Disponible" : "Louée"}</Badge></div>
                </div>
                <Separator />
                 <div className="space-y-2">
                    <h4 className="font-semibold text-base">Documents & Expirations</h4>
                    <div className="flex items-center gap-2">
                        <strong>Expiration Assurance:</strong> {assuranceDate ? format(assuranceDate, 'dd/MM/yyyy', { locale: fr }) : 'N/A'}
                        {isAssuranceExpired && <Badge variant="destructive">Expirée</Badge>}
                        {isAssuranceExpiringSoon && <Badge className="bg-accent text-accent-foreground hover:bg-accent/80">Expire bientôt</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                        <strong>Prochaine Visite:</strong> {visiteDate ? format(visiteDate, 'dd/MM/yyyy', { locale: fr }) : 'N/A'}
                        {isVisiteExpired && <Badge variant="destructive">Expirée</Badge>}
                        {isVisiteExpiringSoon && <Badge className="bg-accent text-accent-foreground hover:bg-accent/80">Expire bientôt</Badge>}
                    </div>
                    <div><strong>Vignette:</strong> {car.anneeVignette || 'N/A'}</div>
                </div>
                 {car.maintenanceSchedule && (
                    <>
                        <Separator />
                        <div className="space-y-2">
                            <h4 className="font-semibold text-base">Plan d'Entretien</h4>
                            <div><strong>Prochaine Vidange:</strong> {car.maintenanceSchedule.prochainVidangeKm ? `${car.maintenanceSchedule.prochainVidangeKm.toLocaleString()} km` : 'N/A'}</div>
                            <div><strong>Prochaine Courroie:</strong> {car.maintenanceSchedule.prochaineCourroieKm ? `${car.maintenanceSchedule.prochaineCourroieKm.toLocaleString()} km` : 'N/A'}</div>
                            <div><strong>Prochaine Révision:</strong> {car.maintenanceSchedule.prochaineRevisionDate?.toDate ? format(car.maintenanceSchedule.prochaineRevisionDate.toDate(), 'dd/MM/yyyy') : 'N/A'}</div>
                        </div>
                    </>
                )}
                
                {car.maintenanceHistory && car.maintenanceHistory.length > 0 && (
                    <>
                        <Separator />
                        <div className="space-y-3">
                            <h4 className="font-semibold text-base">Historique d'entretien</h4>
                             <div className="space-y-2">
                                {[...car.maintenanceHistory].sort((a, b) => getSafeDate(b.date)!.getTime() - getSafeDate(a.date)!.getTime()).map((event, index) => (
                                    <div key={index} className="text-xs p-3 bg-muted rounded-md border relative">
                                        <p className="font-bold">{event.typeIntervention}</p>
                                        <p className="text-muted-foreground">{getSafeDate(event.date) ? format(getSafeDate(event.date)!, 'dd/MM/yyyy') : ''} - {event.kilometrage.toLocaleString()} km</p>
                                        <p className="mt-1">{event.description}</p>
                                        {event.cout != null && <div className="font-semibold mt-1 text-right">{formatCurrency(event.cout, 'MAD')}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                <Separator />
                <div>
                    <div className="font-bold text-lg"><strong>Prix par jour:</strong> {formatCurrency(car.prixParJour, 'MAD')}</div>
                </div>
            </div>
        </ScrollArea>
    );
}


export default function CarCard({ car }: { car: Car }) {
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = React.useState(false);

  const { firestore } = useFirebase();
  const { toast } = useToast();

  const { documentAttention, maintenanceAttention } = React.useMemo(() => {
    const today = new Date();
    const docInfo = { needsAttention: false, message: "" };
    const maintInfo = { needsAttention: false, message: "" };

    // Document checks
    const assuranceDate = car.dateExpirationAssurance?.toDate ? car.dateExpirationAssurance.toDate() : null;
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
    const visiteDate = car.dateProchaineVisiteTechnique?.toDate ? car.dateProchaineVisiteTechnique.toDate() : null;
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

    // Maintenance checks
    const { kilometrage, maintenanceSchedule } = car;
    if (maintenanceSchedule) {
        if (maintenanceSchedule.prochainVidangeKm && kilometrage >= maintenanceSchedule.prochainVidangeKm - 1000) {
            maintInfo.needsAttention = true;
            maintInfo.message = "Vidange requise" + (kilometrage >= maintenanceSchedule.prochainVidangeKm ? "." : " bientôt.");
        }
        if (maintenanceSchedule.prochaineCourroieKm && kilometrage >= maintenanceSchedule.prochaineCourroieKm - 2000) {
            maintInfo.needsAttention = true;
            const newMsg = "Changement de courroie requis" + (kilometrage >= maintenanceSchedule.prochaineCourroieKm ? "." : " bientôt.");
            maintInfo.message = maintInfo.message ? `${maintInfo.message} ${newMsg}` : newMsg;
        }
        const revisionDate = maintenanceSchedule.prochaineRevisionDate?.toDate ? maintenanceSchedule.prochaineRevisionDate.toDate() : null;
        if (revisionDate) {
            const daysDiff = differenceInDays(revisionDate, today);
            if (daysDiff <= 15) {
                maintInfo.needsAttention = true;
                const newMsg = "Révision générale requise" + (daysDiff < 0 ? "." : " bientôt.");
                maintInfo.message = maintInfo.message ? `${maintInfo.message} ${newMsg}` : newMsg;
            }
        }
    }

    return { documentAttention: docInfo, maintenanceAttention: maintInfo };
  }, [car]);


  const handleDeleteCar = async (carId: string) => {
    if (!firestore) return;
    const carDocRef = doc(firestore, 'cars', carId);
    
    try {
        await deleteDoc(carDocRef);
        toast({
          title: "Voiture supprimée",
          description: "La voiture a été supprimée de la base de données.",
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
        description: "Vous n'avez pas la permission de supprimer cette voiture.",
      });
    }
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
      <div className="relative w-full sm:w-1/3 h-48 sm:h-auto">
        <div className="absolute top-2 left-2 z-10">
            {car.disponible ? (
              <Badge className="bg-green-600 text-white">Disponible</Badge>
            ) : (
              <Badge variant="destructive">Louée</Badge>
            )}
        </div>
        <Image
            src={car.photoURL}
            alt={`${car.marque} ${car.modele}`}
            fill
            className="object-contain"
            data-ai-hint="car photo"
        />
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
                    {/* Details Dialog */}
                    <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-9 w-9">
                                        <FileText className="h-4 w-4" />
                                    </Button>
                                </DialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Fiche détails</p></TooltipContent>
                        </Tooltip>
                        <DialogContent className="sm:max-w-lg">
                            <DialogHeader>
                                <DialogTitle>Détails du véhicule</DialogTitle>
                                <DialogDescription>{car.marque} {car.modele} - {car.immat}</DialogDescription>
                            </DialogHeader>
                            <CarDetails car={car} />
                        </DialogContent>
                    </Dialog>

                    {/* Edit Sheet */}
                    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <SheetTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-9 w-9">
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

                    {/* Delete Alert Dialog */}
                    <AlertDialog>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon" className="h-9 w-9">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Supprimer</p></TooltipContent>
                        </Tooltip>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Êtes-vous absolument sûr?</AlertDialogTitle>
                                <AlertDialogDescription>
                                Cette action est irréversible. La voiture {car.marque} {car.modele} sera définitivement supprimée.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteCar(car.id)} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
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
