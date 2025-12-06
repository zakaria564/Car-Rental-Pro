
'use client';
import { DashboardHeader } from "@/components/dashboard-header";
import CarTable from "@/components/cars/car-table";
import { useFirebase } from "@/firebase";
import type { Car } from "@/lib/definitions";
import { collection, onSnapshot } from "firebase/firestore";
import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function CarsPage() {
  const { firestore } = useFirebase();
  const [cars, setCars] = React.useState<Car[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = onSnapshot(collection(firestore, "cars"), (snapshot) => {
      const carsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Car));
      setCars(carsData);
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
      ) : (
        <CarTable cars={cars} />
      )}
    </>
  );
}
