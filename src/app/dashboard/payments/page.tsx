'use client';
import { DashboardHeader } from "@/components/dashboard-header";
import PaymentTable from "@/components/payments/payment-table";
import React from "react";
import { useFirebase } from "@/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import type { Payment } from "@/lib/definitions";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

export default function PaymentsPage() {
  const [payments, setPayments] = React.useState<Payment[]>([]);
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

    const paymentsQuery = query(collection(firestore, "payments"), orderBy("paymentDate", "desc"));
    const unsubscribe = onSnapshot(paymentsQuery, (snapshot) => {
      const paymentsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Payment));
      setPayments(paymentsData);
      setLoading(false);
      setError(null);
    }, (serverError) => {
      setLoading(false);
      setError("Impossible de charger les paiements. Vérifiez vos permissions.");
      const permissionError = new FirestorePermissionError({
        path: collection(firestore, "payments").path,
        operation: 'list'
      }, serverError as Error);
      errorEmitter.emit('permission-error', permissionError);
    });

    return () => unsubscribe();
  }, [firestore]);

  return (
    <>
      <DashboardHeader title="Paiements" description="Gérez et suivez tous les paiements de location." />
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
        <PaymentTable payments={payments} />
      )}
    </>
  );
}
