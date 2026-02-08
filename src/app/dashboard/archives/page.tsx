'use client';
import { DashboardHeader } from "@/components/dashboard-header";
import ArchiveTable from "@/components/archives/archive-table";
import React from "react";
import { useFirebase } from "@/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import type { Rental, Payment, Car } from "@/lib/definitions";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ArchivedPaymentsTable from "@/components/archives/archived-payments-table";
import ArchivedCarsTable from "@/components/archives/archived-cars-table";

export default function ArchivesPage() {
  const [archivedRentals, setArchivedRentals] = React.useState<Rental[]>([]);
  const [archivedPayments, setArchivedPayments] = React.useState<Payment[]>([]);
  const [archivedCars, setArchivedCars] = React.useState<Car[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  let firestore: any;

  try {
    const firebase = useFirebase();
    firestore = firebase.firestore;
  } catch (e: any) {
    React.useEffect(() => {
      console.error(e.message);
    }, [e]);
  }

  React.useEffect(() => {
    if (!firestore) return;
    
    const loadedStatus = { rentals: false, payments: false, cars: false };
    const checkAllLoaded = () => {
        if (loadedStatus.rentals && loadedStatus.payments && loadedStatus.cars) {
            setLoading(false);
        }
    };

    const unsubRentals = onSnapshot(collection(firestore, "archived_rentals"), (snapshot) => {
      const rentalsData = snapshot.docs.map((doc) => ({ 
        ...(doc.data() as Omit<Rental, 'id'>),
        id: doc.id,
      } as Rental));

      rentalsData.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return dateB - dateA;
      });

      setArchivedRentals(rentalsData);
      if (!loadedStatus.rentals) {
          loadedStatus.rentals = true;
          checkAllLoaded();
      }
    }, (serverError) => {
      setLoading(false);
      setError("Impossible de charger les contrats supprimés.");
      const permissionError = new FirestorePermissionError({
        path: collection(firestore, "archived_rentals").path,
        operation: 'list'
      }, serverError as Error);
      errorEmitter.emit('permission-error', permissionError);
    });

    const unsubPayments = onSnapshot(collection(firestore, "archived_payments"), (snapshot) => {
      const paymentsData = snapshot.docs.map((doc) => ({ 
        ...(doc.data() as Omit<Payment, 'id'>),
        id: doc.id,
      } as Payment));

      paymentsData.sort((a, b) => {
        const dateA = a.paymentDate?.toDate ? a.paymentDate.toDate().getTime() : 0;
        const dateB = b.paymentDate?.toDate ? b.paymentDate.toDate().getTime() : 0;
        return dateB - dateA;
      });
      
      setArchivedPayments(paymentsData);
      if (!loadedStatus.payments) {
          loadedStatus.payments = true;
          checkAllLoaded();
      }
    }, (serverError) => {
      setLoading(false);
      setError(prev => (prev ? prev + " " : "") + "Impossible de charger les paiements supprimés.");
      const permissionError = new FirestorePermissionError({
        path: collection(firestore, "archived_payments").path,
        operation: 'list'
      }, serverError as Error);
      errorEmitter.emit('permission-error', permissionError);
    });
    
    const carsQuery = query(collection(firestore, "archived_cars"), orderBy("marque", "asc"));
    const unsubCars = onSnapshot(carsQuery, (snapshot) => {
        const carsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Car));
        setArchivedCars(carsData);
        if (!loadedStatus.cars) {
            loadedStatus.cars = true;
            checkAllLoaded();
        }
    }, (serverError) => {
        setLoading(false);
        setError(prev => (prev ? prev + " " : "") + "Impossible de charger les véhicules supprimés.");
        const permissionError = new FirestorePermissionError({
            path: collection(firestore, "archived_cars").path,
            operation: 'list'
        }, serverError as Error);
        errorEmitter.emit('permission-error', permissionError);
    });

    return () => {
      unsubRentals();
      unsubPayments();
      unsubCars();
    };
  }, [firestore]);

  return (
    <>
      <DashboardHeader title="Corbeille" description="Consultez tous vos contrats, paiements et véhicules supprimés." />
      <Tabs defaultValue="contracts" className="w-full">
        <TabsList>
          <TabsTrigger value="contracts">Contrats</TabsTrigger>
          <TabsTrigger value="payments">Paiements</TabsTrigger>
          <TabsTrigger value="cars">Véhicules</TabsTrigger>
        </TabsList>
        <TabsContent value="contracts">
          {loading ? (
            <div className="space-y-2 mt-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
             <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erreur de chargement</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <ArchiveTable rentals={archivedRentals} />
          )}
        </TabsContent>
        <TabsContent value="payments">
           {loading ? (
            <div className="space-y-2 mt-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
             <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erreur de chargement</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <ArchivedPaymentsTable payments={archivedPayments} rentals={archivedRentals} />
          )}
        </TabsContent>
        <TabsContent value="cars">
          {loading ? (
            <div className="space-y-2 mt-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
             <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erreur de chargement</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <ArchivedCarsTable cars={archivedCars} />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
