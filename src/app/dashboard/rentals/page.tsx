
'use client';
import { DashboardHeader } from "@/components/dashboard-header";
import RentalTable from "@/components/rentals/rental-table";
import React from "react";
import { useFirebase } from "@/firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from "firebase/firestore";
import type { Rental } from "@/lib/definitions";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useToast } from "@/hooks/use-toast";

export default function RentalsPage() {
  const [rentals, setRentals] = React.useState<Rental[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();
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

    const rentalsQuery = query(collection(firestore, "rentals"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(rentalsQuery, (snapshot) => {
      const rentalsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Rental));
      setRentals(rentalsData);
      setLoading(false);
      setError(null);
    }, (serverError) => {
      setLoading(false);
      setError("Impossible de charger les locations. Vérifiez vos permissions.");
      const permissionError = new FirestorePermissionError({
        path: collection(firestore, "rentals").path,
        operation: 'list'
      }, serverError);
      errorEmitter.emit('permission-error', permissionError);
    });

    return () => unsubscribe();
  }, [firestore]);

  const handleEndRental = async (rental: Rental) => {
    if (!firestore || !rental.id || !rental.vehicule.carId) return;
    const rentalDocRef = doc(firestore, 'rentals', rental.id);
    const carDocRef = doc(firestore, 'cars', rental.vehicule.carId);
    
    try {
        await updateDoc(rentalDocRef, { statut: 'terminee' });
        await updateDoc(carDocRef, { disponible: true });
        toast({ title: "Location terminée", description: `La location a été marquée comme terminée.` });
    } catch(e: any) {
        console.error(e);
        const permissionError = new FirestorePermissionError({
          path: rentalDocRef.path,
          operation: 'update',
          requestResourceData: { statut: 'terminee' }
        }, e);
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: "Erreur", description: "Impossible de terminer la location."});
    }
  };


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
        <RentalTable rentals={rentals} onEndRental={handleEndRental} />
      )}
    </>
  );
}

    