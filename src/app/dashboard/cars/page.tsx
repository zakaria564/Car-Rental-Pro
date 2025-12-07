
'use client';
import { DashboardHeader } from "@/components/dashboard-header";
import CarCard from "@/components/cars/car-card";
import { useFirebase } from "@/firebase";
import type { Car } from "@/lib/definitions";
import { collection, onSnapshot } from "firebase/firestore";
import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, PlusCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import CarForm from "@/components/cars/car-form";

export default function CarsPage() {
  const [cars, setCars] = React.useState<Car[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  let firestore: any;

  try {
    const firebase = useFirebase();
    firestore = firebase.firestore;
  } catch (e: any) {
     React.useEffect(() => {
      // We catch the error to prevent the app from crashing and show a message.
      // The provider will re-render and this will be re-attempted.
      console.error(e.message);
    }, [e]);
  }

  React.useEffect(() => {
    if (!firestore) return; // Don't run if firestore is not available yet.

    const carsCollection = collection(firestore, "cars");
    const unsubscribe = onSnapshot(carsCollection, (snapshot) => {
      const carsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Car));
      setCars(carsData);
      setLoading(false);
      setError(null);
    }, (serverError) => {
        setLoading(false);
        setError("Impossible de charger les voitures. Vérifiez vos permissions.");

        const permissionError = new FirestorePermissionError({
            path: carsCollection.path,
            operation: 'list'
        }, serverError);
        errorEmitter.emit('permission-error', permissionError);
    });

    return () => unsubscribe();
  }, [firestore]);

  const filteredCars = cars.filter(car => 
    car.marque.toLowerCase().includes(searchTerm.toLowerCase()) ||
    car.modele.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
      <DashboardHeader title="Voitures" description="Gérez votre flotte de véhicules." />
      <div className="flex items-center py-4 gap-2">
          <Input
            placeholder="Filtrer par marque ou modèle..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="max-w-sm"
          />
          <SheetTrigger asChild>
            <Button className="ml-auto bg-primary hover:bg-primary/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Ajouter une voiture
            </Button>
          </SheetTrigger>
        </div>

       {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-80 w-full" />)}
        </div>
      ) : error ? (
         <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erreur de chargement</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCars.map(car => (
                <CarCard key={car.id} car={car} />
            ))}
        </div>
      )}
      { !loading && !error && filteredCars.length === 0 && (
         <div className="text-center col-span-full py-12">
            <p className="text-muted-foreground">Aucun véhicule trouvé pour "{searchTerm}".</p>
          </div>
      )}

      <SheetContent className="sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>Ajouter une nouvelle voiture</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-full pr-6">
          <CarForm car={null} onFinished={() => setIsSheetOpen(false)} />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
