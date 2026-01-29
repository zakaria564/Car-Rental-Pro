
'use client';
import { DashboardHeader } from "@/components/dashboard-header";
import PaymentTable from "@/components/payments/payment-table";
import React from "react";
import { useFirebase } from "@/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import type { Payment, Rental } from "@/lib/definitions";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, PlusCircle, DollarSign } from "lucide-react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import PaymentForm from "@/components/payments/payment-form";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentsPage() {
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [rentals, setRentals] = React.useState<Rental[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
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

    const loadedStatus = { payments: false, rentals: false };
    const checkAllLoaded = () => {
        if (loadedStatus.payments && loadedStatus.rentals) {
            setLoading(false);
        }
    };

    const paymentsQuery = query(collection(firestore, "payments"), orderBy("paymentDate", "desc"));
    const unsubPayments = onSnapshot(paymentsQuery, (snapshot) => {
      const paymentsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Payment));
      setPayments(paymentsData);
      if (!loadedStatus.payments) {
          loadedStatus.payments = true;
          checkAllLoaded();
      }
    }, (serverError) => {
      setLoading(false);
      setError("Impossible de charger les paiements. Vérifiez vos permissions.");
      const permissionError = new FirestorePermissionError({
        path: collection(firestore, "payments").path,
        operation: 'list'
      }, serverError as Error);
      errorEmitter.emit('permission-error', permissionError);
    });

    const rentalsQuery = query(collection(firestore, "rentals"), orderBy("createdAt", "desc"));
    const unsubRentals = onSnapshot(rentalsQuery, (snapshot) => {
      const rentalsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Rental));
      setRentals(rentalsData);
      if (!loadedStatus.rentals) {
        loadedStatus.rentals = true;
        checkAllLoaded();
      }
    }, (err) => {
        console.error("Error loading rentals:", err);
        setError(prev => (prev ? prev + " " : "") + "Impossible de charger les contrats.");
    });


    return () => {
        unsubPayments();
        unsubRentals();
    };
  }, [firestore]);
  
  const monthlyRevenue = React.useMemo(() => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return payments.reduce((acc, p) => {
        if (p.paymentDate?.toDate) {
            const paymentDate = p.paymentDate.toDate();
            if (paymentDate >= firstDayOfMonth && paymentDate <= lastDayOfMonth) {
                return acc + (p.amount || 0);
            }
        }
        return acc;
    }, 0);
  }, [payments]);

  return (
    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DashboardHeader title="Paiements" description="Gérez et suivez tous les paiements de location.">
            <SheetTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                    <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un paiement
                </Button>
            </SheetTrigger>
        </DashboardHeader>
        
        <div className="mb-4">
             {loading ? (
                <Skeleton className="h-40 w-full" />
             ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="h-40 flex flex-col">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Revenu du mois</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="flex-grow flex items-end justify-center pb-4">
                            <div className="text-3xl font-bold">{formatCurrency(monthlyRevenue, 'MAD')}</div>
                        </CardContent>
                    </Card>
                </div>
             )}
        </div>
      
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

        <SheetContent className="sm:max-w-md">
            <SheetHeader>
                <SheetTitle>Ajouter un nouveau paiement</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-full pr-4">
                <PaymentForm payment={null} rentals={rentals} onFinished={() => setIsSheetOpen(false)} />
            </ScrollArea>
        </SheetContent>
    </Sheet>
  );
}
