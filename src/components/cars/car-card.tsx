
"use client";

import * as React from "react";
import Image from "next/image";
import { Wrench, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Car } from "@/lib/definitions";
import { formatCurrency } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import CarForm from "./car-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

export default function CarCard({ car }: { car: Car }) {
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = React.useState(false);
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
    <Card className="flex flex-col overflow-hidden">
        <div className="relative">
            <Badge variant={car.disponible ? "default" : "destructive"} className={`absolute top-2 right-2 z-10 ${car.disponible ? 'bg-green-600' : ''}`}>
                {car.disponible ? "Disponible" : "Louée"}
            </Badge>
            <Image
                src={car.photoURL}
                alt={`${car.marque} ${car.modele}`}
                width={300}
                height={200}
                className="object-cover aspect-video w-full"
                data-ai-hint="car photo"
            />
        </div>
        <div className="flex flex-col flex-grow p-3">
            <CardContent className="p-0 flex-grow mb-2">
                <h3 className="text-base font-bold truncate">{car.marque} {car.modele}</h3>
                <p className="text-sm text-muted-foreground">{car.immat}</p>
            </CardContent>
            <div className="flex flex-col items-start gap-2">
                <div className="font-bold text-lg w-full">{formatCurrency(car.prixParJour, 'MAD')}<span className="text-xs font-normal text-muted-foreground">/jour</span></div>
                <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                    <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
                        <AlertDialog>
                        <TooltipProvider>
                            <div className="w-full flex justify-between items-center gap-1">
                                <SheetTrigger asChild>
                                <Button variant="outline" size="sm" className="flex-1">
                                    <Pencil className="h-4 w-4 mr-1" /> Modifier
                                </Button>
                                </SheetTrigger>
                                <Tooltip>
                                <TooltipTrigger asChild>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="icon" className="h-9 w-9">
                                            <Wrench className="h-4 w-4" />
                                        </Button>
                                    </DialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Vérifier l'entretien (IA)</p>
                                </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" size="icon" className="h-9 w-9">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Supprimer</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </TooltipProvider>

                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
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

                        <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Vérification IA de l'entretien pour {car.marque} {car.modele}</DialogTitle>
                        </DialogHeader>
                        <MaintenanceChecker carId={car.id} />
                        </DialogContent>

                        <SheetContent className="sm:max-w-[480px]">
                            <SheetHeader>
                                <SheetTitle>Modifier la voiture</SheetTitle>
                            </SheetHeader>
                            <ScrollArea className="h-full pr-6">
                                <CarForm car={car} onFinished={() => setIsSheetOpen(false)} />
                            </ScrollArea>
                        </SheetContent>
                    </Dialog>
                </Sheet>
            </div>
        </div>
    </Card>
  );
}
