
"use client";

import * as React from "react";
import Image from "next/image";
import { Wrench, Pencil, Trash2, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Car } from "@/lib/definitions";
import { formatCurrency } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import CarForm from "./car-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import MaintenanceChecker from "./maintenance-checker";
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

function CarDetails({ car }: { car: Car }) {
    return (
        <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <p><strong>Marque:</strong> {car.marque}</p>
                <p><strong>Modèle:</strong> {car.modele}</p>
                <p><strong>Année:</strong> {car.modeleAnnee}</p>
                <p><strong>Immatriculation:</strong> {car.immat}</p>
                <p><strong>N° de châssis:</strong> {car.numChassis}</p>
                <p><strong>Couleur:</strong> {car.couleur}</p>
                <p><strong>Kilométrage:</strong> {car.kilometrage.toLocaleString()} km</p>
                <p><strong>Carburant:</strong> {car.carburantType}</p>
                <p><strong>Puissance:</strong> {car.puissance} cv</p>
                <p><strong>Places:</strong> {car.nbrPlaces}</p>
                <p><strong>État:</strong> {car.etat}</p>
                <div className="flex items-center gap-2"><strong>Disponibilité:</strong> <Badge variant={car.disponible ? "default" : "destructive"} className={car.disponible ? 'bg-green-600' : ''}>{car.disponible ? "Disponible" : "Louée"}</Badge></div>
            </div>
            <Separator />
            <div>
                <p className="font-bold text-lg"><strong>Prix par jour:</strong> {formatCurrency(car.prixParJour, 'MAD')}</p>
            </div>
        </div>
    );
}


export default function CarCard({ car }: { car: Car }) {
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = React.useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = React.useState(false);

  const { firestore } = useFirebase();
  const { toast } = useToast();

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
    <Card className="flex flex-row overflow-hidden group w-full">
      <div className="relative w-2/5">
        {car.disponible ? (
          <Badge className="absolute top-2 right-2 z-10 bg-green-600 text-white">Disponible</Badge>
        ) : (
          <Badge variant="destructive" className="absolute top-2 right-2 z-10">Louée</Badge>
        )}
        <Image
            src={car.photoURL}
            alt={`${car.marque} ${car.modele}`}
            fill
            className="object-cover"
            data-ai-hint="car photo"
        />
      </div>
      <div className="p-4 flex flex-col flex-grow w-3/5">
        <div className="flex-grow">
          <h3 className="text-lg font-bold truncate">{car.marque} {car.modele}</h3>
          <p className="text-sm text-muted-foreground">{car.immat}</p>
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

                    {/* Maintenance Dialog */}
                    <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-9 w-9">
                                        <Wrench className="h-4 w-4" />
                                    </Button>
                                </DialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Vérifier l'entretien (IA)</p></TooltipContent>
                        </Tooltip>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Vérification IA de l'entretien pour {car.marque} {car.modele}</DialogTitle>
                            </DialogHeader>
                            <MaintenanceChecker carId={car.id} />
                        </DialogContent>
                    </Dialog>

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
