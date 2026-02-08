
'use client';
import { DashboardHeader } from "@/components/dashboard-header";
import ClientTable from "@/components/clients/client-table";
import { useFirebase } from "@/firebase";
import type { Client } from "@/lib/definitions";
import { collection, onSnapshot } from "firebase/firestore";
import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function ClientsPage() {
  const [clients, setClients] = React.useState<Client[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { firestore } = useFirebase();

  React.useEffect(() => {
    if (!firestore) return;

    const clientsCollection = collection(firestore, "clients");
    const unsubscribe = onSnapshot(clientsCollection, (snapshot) => {
      const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      setClients(clientsData);
      setLoading(false);
      setError(null);
    }, (serverError) => {
        setLoading(false);
        setError("Impossible de charger les clients. Vérifiez vos permissions.");

        const permissionError = new FirestorePermissionError({
            path: clientsCollection.path,
            operation: 'list'
        }, serverError);
        errorEmitter.emit('permission-error', permissionError);
    });

    return () => unsubscribe();
  }, [firestore]);


  return (
    <>
      <DashboardHeader title="Clients" description="Gérez les informations de vos clients." />
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
        <ClientTable clients={clients} />
      )}
    </>
  );
}
