
'use client';
import { DashboardHeader } from "@/components/dashboard-header";
import CarTable from "@/components/cars/car-table";
import { useFirebase } from "@/firebase";
import type { Car } from "@/lib/definitions";
import { collection, onSnapshot } from "firebase/firestore";
import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

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

    const unsubscribe = onSnapshot(collection(firestore, "cars"), (snapshot) => {
      const carsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Car));
      setCars(carsData);
      setLoading(false);
    }, (err) => {
        console.error("Error fetching cars:", err);
        setError("Impossible de charger les voitures. Veuillez réessayer plus tard.");
        setLoading(false);
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
        <div className="text-red-500">{error}</div>
      ) : (
        <CarTable cars={cars} />
      )}
    </>
  );
}
