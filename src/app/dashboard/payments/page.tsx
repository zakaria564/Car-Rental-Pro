
'use client';
import { DashboardHeader } from "@/components/dashboard-header";
import PaymentTable from "@/components/payments/payment-table";
import React from "react";
import { useFirebase } from "@/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import type { Payment, Rental } from "@/lib/definitions";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, PlusCircle, Eye, EyeOff, TrendingUp } from "lucide-react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import PaymentForm from "@/components/payments/payment-form";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentsPage() {
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [rentals, setRentals] = React.useState<Rental[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [rentalIdForNewPayment, setRentalIdForNewPayment] = React.useState<string | null>(null);
  const [showTotal, setShowTotal] = React.useState(false);
  const { firestore } = useFirebase();

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
  
  const totalCollected = React.useMemo(() => {
    return payments.reduce((acc, p) => acc + (p.amount || 0), 0);
  }, [payments]);

  const handleAddPaymentForRental = (rentalId: string) => {
    setRentalIdForNewPayment(rentalId);
    setIsSheetOpen(true);
  };

  const handleSheetOpenChange = (open: boolean) => {
    setIsSheetOpen(open);
    if (!open) {
      setRentalIdForNewPayment(null);
    }
  };
  
  return (
    <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
        <DashboardHeader title="Comptabilité" description="Suivez la situation financière de vos contrats.">
            <SheetTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90" onClick={() => setRentalIdForNewPayment(null)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un paiement
                </Button>
            </SheetTrigger>
        </DashboardHeader>
      
        {loading ? (
            <div className="space-y-4">
                <Skeleton className="h-24 w-full max-w-[300px]" />
                <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            </div>
        ) : error ? (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erreur de chargement</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        ) : (
            <div className="space-y-6">
                <div className="flex justify-start">
                    <Card className="w-full max-w-[300px] shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Total Encaissé</CardTitle>
                            <TrendingUp className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div className="text-2xl font-black tracking-tight">
                                    {showTotal ? formatCurrency(totalCollected, 'MAD') : "••••••"}
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => setShowTotal(!showTotal)}
                                    className="h-8 w-8 hover:bg-muted"
                                    title={showTotal ? "Masquer le montant" : "Afficher le montant"}
                                >
                                    {showTotal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <PaymentTable 
                  rentals={rentals} 
                  payments={payments} 
                  onAddPaymentForRental={handleAddPaymentForRental} 
                />
            </div>
        )}

        <SheetContent className="sm:max-w-md flex flex-col">
            <SheetHeader>
                <SheetTitle>Ajouter un nouveau paiement</SheetTitle>
            </SheetHeader>
            <div className="flex-1 min-h-0">
                <PaymentForm 
                  payment={null} 
                  rentals={rentals} 
                  onFinished={() => setIsSheetOpen(false)}
                  preselectedRentalId={rentalIdForNewPayment}
                />
            </div>
        </SheetContent>
    </Sheet>
  );
}
