
'use client';
import { Car, KeyRound, DollarSign } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import RentalTable from "@/components/rentals/rental-table";
import { DashboardHeader } from "@/components/dashboard-header";
import { formatCurrency } from "@/lib/utils";
import React from "react";
import { useFirebase } from "@/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import type { Car as CarType, Rental } from "@/lib/definitions";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const [rentals, setRentals] = React.useState<Rental[]>([]);
  const [cars, setCars] = React.useState<CarType[]>([]);
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
    setLoading(true);
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const carsUnsubscribe = onSnapshot(collection(firestore, "cars"), (snapshot) => {
      const carsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CarType));
      setCars(carsData);
    }, (err) => {
      console.error("Erreur de chargement des voitures:", err);
      setError("Impossible de charger les données des voitures.");
    });

    const rentalsUnsubscribe = onSnapshot(collection(firestore, "rentals"), (snapshot) => {
      const rentalsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Rental));
      setRentals(rentalsData);
      setLoading(false);
    }, (err) => {
      console.error("Erreur de chargement des locations:", err);
      setError("Impossible de charger les données des locations.");
      setLoading(false);
    });

    return () => {
      carsUnsubscribe();
      rentalsUnsubscribe();
    };
  }, [firestore]);


  const availableCars = cars.filter(c => c.disponible).length;
  const activeRentals = rentals.filter(r => r.statut === 'en_cours').length;
  
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthlyRevenue = rentals.reduce((acc, r) => {
    // Check if createdAt exists and has the toDate method (i.e., it's a Firestore Timestamp)
    if (r.createdAt?.toDate) {
      const rentalDate = r.createdAt.toDate();
      if (rentalDate >= firstDayOfMonth) {
        return acc + (r.location.montantAPayer || 0);
      }
    }
    return acc;
  }, 0);


  return (
    <>
      <DashboardHeader title="Tableau de bord" description="Un aperçu de votre activité de location." />
      {loading ? (
        <>
            <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
            </div>
            <div className="mt-8">
                 <Skeleton className="h-10 w-64 mb-4" />
                 <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            </div>
        </>
      ) : (
      <>
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
            <StatCard title="Voitures totales" value={cars.length.toString()} icon={Car} />
            <StatCard title="Voitures disponibles" value={`${availableCars} / ${cars.length}`} icon={Car} color="text-green-500" />
            <StatCard title="Locations actives" value={activeRentals.toString()} icon={KeyRound} />
            <StatCard title="Revenu total (mois)" value={formatCurrency(monthlyRevenue, 'MAD')} icon={DollarSign} />
        </div>
        <div>
            <h2 className="text-2xl font-semibold tracking-tight mb-4">Locations récentes</h2>
            <RentalTable rentals={rentals.slice(0, 5)} isDashboard={true} />
        </div>
      </>
      )}
    </>
  );
}
