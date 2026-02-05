'use client';
import { DashboardHeader } from "@/components/dashboard-header";
import ArchiveTable from "@/components/archives/archive-table";
import React from "react";
import { useFirebase } from "@/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import type { Rental } from "@/lib/definitions";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

export default function ArchivesPage() {
  const [archivedRentals, setArchivedRentals] = React.useState<Rental[]>([]);
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
    
    const rentalsQuery = query(collection(firestore, "archived_rentals"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(rentalsQuery, (snapshot) => {
      const rentalsData = snapshot.docs.map((doc) => ({ 
        ...(doc.data() as Omit<Rental, 'id'>),
        id: doc.id,
      } as Rental));

      setArchivedRentals(rentalsData);
      setLoading(false);
      
    }, (serverError) => {
      setLoading(false);
      setError("Impossible de charger les archives. Vérifiez vos permissions.");
      const permissionError = new FirestorePermissionError({
        path: collection(firestore, "archived_rentals").path,
        operation: 'list'
      }, serverError as Error);
      errorEmitter.emit('permission-error', permissionError);
    });

    return () => unsubscribe();
  }, [firestore]);

  return (
    <>
      <DashboardHeader title="Archives" description="Consultez tous vos contrats et paiements archivés." />
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
        <ArchiveTable rentals={archivedRentals} />
      )}
    </>
  );
}
