
'use client';
import { DashboardHeader } from "@/components/dashboard-header";
import RentalTable from "@/components/rentals/rental-table";
import React from "react";
import { useFirebase } from "@/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import type { Rental, Car, Client } from "@/lib/definitions";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useToast } from "@/hooks/use-toast";

export default function RentalsPage() {
  const [rentals, setRentals] = React.useState<Rental[]>([]);
  const [cars, setCars] = React.useState<Car[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();
  const { firestore } = useFirebase();

  React.useEffect(() => {
    if (!firestore) return;

    const loadedStatus = { rentals: false, cars: false, clients: false };

    const checkAllLoaded = () => {
      if (loadedStatus.rentals && loadedStatus.cars && loadedStatus.clients) {
        setLoading(false);
      }
    };
    
    const rentalsQuery = query(collection(firestore, "rentals"), orderBy("createdAt", "desc"));
    const unsubRentals = onSnapshot(rentalsQuery, (snapshot) => {
      const rentalsData = snapshot.docs.map((doc) => ({ 
        ...(doc.data() as Omit<Rental, 'id'>),
        id: doc.id,
      } as Rental));

      setRentals(rentalsData);
      
      if (!loadedStatus.rentals) {
        loadedStatus.rentals = true;
        checkAllLoaded();
      }
    }, (serverError) => {
      setLoading(false);
      setError("Impossible de charger les locations. Vérifiez vos permissions.");
      const permissionError = new FirestorePermissionError({
        path: collection(firestore, "rentals").path,
        operation: 'list'
      }, serverError);
      errorEmitter.emit('permission-error', permissionError);
    });

    const unsubCars = onSnapshot(collection(firestore, "cars"), (snapshot) => {
        const carsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Car));
        setCars(carsData);
        if (!loadedStatus.cars) {
            loadedStatus.cars = true;
            checkAllLoaded();
        }
    }, (err) => {
        console.error("Error loading cars:", err);
        setError(prev => (prev ? prev + " " : "") + "Impossible de charger les voitures.");
    });

    const unsubClients = onSnapshot(collection(firestore, "clients"), (snapshot) => {
        const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
        setClients(clientsData);
        if (!loadedStatus.clients) {
            loadedStatus.clients = true;
            checkAllLoaded();
        }
    }, (err) => {
        console.error("Error loading clients:", err);
        setError(prev => (prev ? prev + " " : "") + "Impossible de charger les clients.");
    });


    return () => {
      unsubRentals();
      unsubCars();
      unsubClients();
    };
  }, [firestore]);

  return (
    <>
      <DashboardHeader title="Contrats" description="Gérez tous les enregistrements de location de voitures." />
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
        <RentalTable rentals={rentals} clients={clients} cars={cars} />
      )}
    </>
  );
}
