'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Car, Users, KeyRound, LayoutDashboard, CreditCard, Trash2 } from 'lucide-react';
import { cn, getSafeDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import React from 'react';
import { useFirebase } from '@/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import type { Rental, Car as CarType } from '@/lib/definitions';
import { differenceInCalendarDays } from 'date-fns';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
  { href: '/dashboard/cars', icon: Car, label: 'Voitures' },
  { href: '/dashboard/clients', icon: Users, label: 'Clients' },
  { href: '/dashboard/rentals', icon: KeyRound, label: 'Contrats' },
  { href: '/dashboard/payments', icon: CreditCard, label: 'Comptabilité' },
  { href: '/dashboard/archives', icon: Trash2, label: 'Archives' },
];

export function DashboardNav() {
  const pathname = usePathname();
  const [activeRentals, setActiveRentals] = React.useState(0);
  const [unpaidCount, setUnpaidCount] = React.useState(0);
  const [maintAlertCount, setMaintAlertCount] = React.useState(0);
  const [expiredDocCount, setExpiredDocCount] = React.useState(0);
  const [soonDocCount, setSoonDocCount] = React.useState(0);
  const { firestore } = useFirebase();

  React.useEffect(() => {
    if (!firestore) return;

    // Écouteur pour les locations (statistiques contrats et impayés)
    const rentalsCollection = collection(firestore, "rentals");
    const unsubRentals = onSnapshot(rentalsCollection, (snapshot) => {
        const rentalsData = snapshot.docs.map(doc => doc.data() as Rental);
        
        const active = rentalsData.filter(doc => doc.statut === 'en_cours').length;
        setActiveRentals(active);

        const unpaid = rentalsData.filter(rental => {
            const total = rental.location.montantTotal || 0;
            const paid = rental.location.montantPaye || 0;
            return (total - paid) > 0.01;
        }).length;
        setUnpaidCount(unpaid);
    });

    // Écouteur pour les voitures (alertes entretien et documents)
    const carsCollection = collection(firestore, "cars");
    const unsubCars = onSnapshot(carsCollection, (snapshot) => {
        const carsData = snapshot.docs.map(doc => doc.data() as CarType);
        const today = new Date();

        let totalMaint = 0;
        let totalExpired = 0;
        let totalSoon = 0;

        carsData.forEach(car => {
            const { kilometrage, maintenanceSchedule } = car;

            // 1. Calcul des alertes entretien individuelles (Cumulatif)
            if (maintenanceSchedule) {
                const checkMaint = (nextKm: number | undefined, soonThreshold: number) => {
                    if (typeof nextKm !== 'number' || nextKm <= 0) return;
                    const diff = nextKm - kilometrage;
                    if (diff <= 0 || diff <= soonThreshold) {
                        totalMaint++;
                    }
                };

                checkMaint(maintenanceSchedule.prochainVidangeKm, 1000);
                checkMaint(maintenanceSchedule.prochainFiltreGasoilKm, 2000);
                checkMaint(maintenanceSchedule.prochainesPlaquettesFreinKm, 2000);
                checkMaint(maintenanceSchedule.prochaineCourroieDistributionKm, 5000);
            }

            // 2. Calcul des alertes documents individuelles (Cumulatif)
            const checkDoc = (date: any) => {
                const d = getSafeDate(date);
                if (!d) return;
                const diff = differenceInCalendarDays(d, today);
                if (diff < 0) totalExpired++;
                else if (diff <= 7) totalSoon++;
            };

            checkDoc(car.dateExpirationAssurance);
            checkDoc(car.dateProchaineVisiteTechnique);
        });

        setMaintAlertCount(totalMaint);
        setExpiredDocCount(totalExpired);
        setSoonDocCount(totalSoon);
    });

    return () => {
        unsubRentals();
        unsubCars();
    };
  }, [firestore]);


  return (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
            {
              'bg-muted text-primary': pathname === item.href,
            }
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
          
          {item.label === 'Voitures' && (
             <div className="ml-auto flex gap-1">
                {maintAlertCount > 0 && (
                    <Badge 
                        title={`${maintAlertCount} alerte(s) d'entretien`} 
                        className="flex h-5 min-w-5 px-1 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 border-none p-0 text-[10px]"
                    >
                        {maintAlertCount}
                    </Badge>
                )}
                {(expiredDocCount > 0 || soonDocCount > 0) && (
                    <Badge 
                        title={`${expiredDocCount + soonDocCount} alerte(s) de documents`} 
                        className={cn(
                            "flex h-5 min-w-5 px-1 shrink-0 items-center justify-center rounded-full border-none p-0 text-[10px] text-white",
                            expiredDocCount > 0 ? "bg-destructive hover:bg-destructive" : "bg-amber-500 hover:bg-amber-600"
                        )}
                    >
                        {expiredDocCount + soonDocCount}
                    </Badge>
                )}
             </div>
          )}

          {item.label === 'Contrats' && activeRentals > 0 && (
             <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 border-none p-0 text-[10px]">
              {activeRentals}
            </Badge>
          )}

          {item.label === 'Comptabilité' && unpaidCount > 0 && (
            <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground border-none p-0 text-[10px]">
              {unpaidCount}
            </Badge>
          )}
        </Link>
      ))}
    </nav>
  );
}
