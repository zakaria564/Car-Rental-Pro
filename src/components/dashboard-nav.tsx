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
  const [carsAlertCount, setCarsAlertCount] = React.useState(0);
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

        const alerts = carsData.filter(car => {
            // 1. Vérification des documents (Expiraion sous 7 jours ou déjà expiré)
            const assuranceDate = getSafeDate(car.dateExpirationAssurance);
            if (assuranceDate && differenceInCalendarDays(assuranceDate, today) <= 7) return true;

            const visiteDate = getSafeDate(car.dateProchaineVisiteTechnique);
            if (visiteDate && differenceInCalendarDays(visiteDate, today) <= 7) return true;

            // 2. Vérification de l'entretien (Kilométrage atteint ou dépassé)
            if (car.maintenanceSchedule) {
                const km = car.kilometrage;
                const s = car.maintenanceSchedule;
                if ((s.prochainVidangeKm && km >= s.prochainVidangeKm) ||
                    (s.prochainFiltreGasoilKm && km >= s.prochainFiltreGasoilKm) ||
                    (s.prochainesPlaquettesFreinKm && km >= s.prochainesPlaquettesFreinKm) ||
                    (s.prochaineCourroieDistributionKm && km >= s.prochaineCourroieDistributionKm)) {
                    return true;
                }
            }
            return false;
        }).length;

        setCarsAlertCount(alerts);
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
          
          {item.label === 'Voitures' && carsAlertCount > 0 && (
             <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive">
              {carsAlertCount}
            </Badge>
          )}

          {item.label === 'Contrats' && activeRentals > 0 && (
             <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground hover:bg-accent">
              {activeRentals}
            </Badge>
          )}

          {item.label === 'Comptabilité' && unpaidCount > 0 && (
            <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
              {unpaidCount}
            </Badge>
          )}
        </Link>
      ))}
    </nav>
  );
}
