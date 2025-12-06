
'use client';
import { DashboardHeader } from "@/components/dashboard-header";
import CarTable from "@/components/cars/car-table";
import { useFirebase } from "@/firebase";
import type { Car } from "@/lib/definitions";
import { collection, onSnapshot } from "firebase/firestore";
import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function CarsPage() {
  const [cars, setCars] = React.useState<Car[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
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


  return (
    <>
      <DashboardHeader title="Voitures" description="Gérez votre flotte de véhicules." />
       {loading ? (
        <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
        </div>
      ) : error ? (
         <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erreur de chargement</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <CarTable cars={cars} />
      )}
    </>
  );
}
