'use client';
import { Car, KeyRound, TriangleAlert, Wrench, Clock } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import RentalTable from "@/components/rentals/rental-table";
import { DashboardHeader } from "@/components/dashboard-header";
import React from "react";
import { useFirebase } from "@/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import type { Car as CarType, Rental } from "@/lib/definitions";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, startOfDay, differenceInCalendarDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from "next/link";
import { cn, getSafeDate } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export default function DashboardPage() {
  const [rentals, setRentals] = React.useState<Rental[]>([]);
  const [cars, setCars] = React.useState<CarType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { firestore } = useFirebase();

  React.useEffect(() => {
    if (!firestore) return;
    setLoading(true);
    
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


  const activeRentalsList = React.useMemo(() => 
    rentals.filter(r => r.statut === 'en_cours')
  , [rentals]);
  
  // Une voiture est "disponible" seulement si son statut est 'disponible' 
  // ET qu'elle n'a pas d'entretien en retard ("À faire")
  const availableCarsCount = React.useMemo(() => {
    return cars.filter(c => {
        if (c.disponibilite !== 'disponible') return false;
        
        if (c.maintenanceSchedule) {
            const km = c.kilometrage;
            const s = c.maintenanceSchedule;
            if ((s.prochainVidangeKm && km >= s.prochainVidangeKm) ||
                (s.prochainFiltreGasoilKm && km >= s.prochainFiltreGasoilKm) ||
                (s.prochainesPlaquettesFreinKm && km >= s.prochainesPlaquettesFreinKm) ||
                (s.prochaineCourroieDistributionKm && km >= s.prochaineCourroieDistributionKm)) {
                return false;
            }
        }
        return true;
    }).length;
  }, [cars]);
  
  const returnsToday = React.useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    return rentals.filter(r => {
        if (r.statut !== 'en_cours') return false;
        const endDate = getSafeDate(r.location.dateFin);
        return endDate && startOfDay(endDate).getTime() === today;
    }).length;
  }, [rentals]);
  
  const expiringDocuments = React.useMemo(() => {
    const today = new Date();
    const alerts: { car: CarType, documentName: string, expiryDate: Date, status: 'Expiré' | 'Expire bientôt' }[] = [];

    cars.forEach(car => {
        const assuranceDate = getSafeDate(car.dateExpirationAssurance);
        if (assuranceDate) {
            const daysDiff = differenceInCalendarDays(assuranceDate, today);
            if (daysDiff < 0) {
                alerts.push({ car, documentName: 'Assurance', expiryDate: assuranceDate, status: 'Expiré' });
            } else if (daysDiff <= 7) {
                alerts.push({ car, documentName: 'Assurance', expiryDate: assuranceDate, status: 'Expire bientôt' });
            }
        }

        const visiteDate = getSafeDate(car.dateProchaineVisiteTechnique);
        if (visiteDate) {
            const daysDiff = differenceInCalendarDays(visiteDate, today);
            if (daysDiff < 0) {
                alerts.push({ car, documentName: 'Visite Technique', expiryDate: visiteDate, status: 'Expiré' });
            } else if (daysDiff <= 7) {
                alerts.push({ car, documentName: 'Visite Technique', expiryDate: visiteDate, status: 'Expire bientôt' });
            }
        }
    });

    return alerts.sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());
  }, [cars]);
  
 const maintenanceAlerts = React.useMemo(() => {
    const alerts: { car: CarType, alertType: string, value: string, currentValue: string, status: 'À faire' | 'Bientôt' }[] = [];

    cars.forEach(car => {
        const { kilometrage, maintenanceSchedule } = car;
        if (!maintenanceSchedule) return;

        const checkKmAlert = (nextKm: number | undefined, type: string, soonThreshold: number = 1000) => {
            if (typeof nextKm !== 'number') return;
            const diff = nextKm - kilometrage;
            if (diff <= 0) {
                alerts.push({ car, alertType: type, value: `${nextKm.toLocaleString()} km`, currentValue: `${kilometrage.toLocaleString()} km`, status: 'À faire' });
            } else if (diff <= soonThreshold) {
                alerts.push({ car, alertType: type, value: `${nextKm.toLocaleString()} km`, currentValue: `${kilometrage.toLocaleString()} km`, status: 'Bientôt' });
            }
        };

        checkKmAlert(maintenanceSchedule.prochainVidangeKm, "Vidange");
        checkKmAlert(maintenanceSchedule.prochainFiltreGasoilKm, "Filtre à gazole", 2000);
        checkKmAlert(maintenanceSchedule.prochainesPlaquettesFreinKm, "Plaquettes de frein", 2000);
        checkKmAlert(maintenanceSchedule.prochaineCourroieDistributionKm, "Courroie de distribution", 5000);

    });

    return alerts.sort((a, b) => {
        if (a.status === 'À faire' && b.status !== 'À faire') return -1;
        if (a.status !== 'À faire' && b.status === 'À faire') return 1;
        if (a.value < b.value) return -1;
        if (a.value > b.value) return 1;
        return 0;
    });
  }, [cars]);

  return (
    <>
      <DashboardHeader title="Tableau de bord" description="Un aperçu de votre activité de location." />
      {loading ? (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
            </div>
            <div className="grid gap-4">
                <Skeleton className="h-72" />
                <Skeleton className="h-72" />
            </div>
        </div>
      ) : (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
            <StatCard title="Voitures totales" value={cars.length.toString()} icon={Car} />
            <StatCard title="Voitures disponibles" value={`${availableCarsCount} / ${cars.length}`} icon={Car} color="text-green-500" />
            <StatCard title="Locations actives" value={activeRentalsList.length.toString()} icon={KeyRound} />
            <StatCard 
                title="Retours aujourd'hui" 
                value={returnsToday.toString()} 
                icon={Clock} 
                color={returnsToday > 0 ? "text-red-500" : "text-muted-foreground"} 
            />
        </div>
        <div className="grid gap-6">
            {/* Locations en cours */}
            <Card>
                <CardHeader>
                    <CardTitle>Locations en cours</CardTitle>
                </CardHeader>
                <CardContent>
                    <RentalTable rentals={activeRentalsList.slice(0, 5)} isDashboard={true} />
                </CardContent>
            </Card>

            {/* Alertes Entretien */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Wrench className="h-5 w-5 text-blue-500" />
                        <span>Alertes Entretien</span>
                    </CardTitle>
                    <CardDescription>
                        Véhicules nécessitant un entretien prochainement ou en retard.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   {maintenanceAlerts.length > 0 ? (
                    <div className="space-y-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-[12px] font-bold">Véhicule</TableHead>
                                    <TableHead className="text-[12px] font-bold">Intervention</TableHead>
                                    <TableHead className="text-[12px] font-bold text-center">Km Actuel</TableHead>
                                    <TableHead className="text-right text-[12px] font-bold">Échéance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {maintenanceAlerts.slice(0, 5).map((alert, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="text-[12px]">
                                            <div className="font-medium">{alert.car.marque} {alert.car.modele}</div>
                                            <div className="text-[11px] text-muted-foreground">
                                                {alert.car.immat}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-[12px]">{alert.alertType}</TableCell>
                                        <TableCell className="text-[12px] text-center">{alert.currentValue}</TableCell>
                                        <TableCell className="text-right text-[12px]">
                                            <div className="flex flex-col items-end">
                                                <span className="font-semibold">{alert.value}</span>
                                                <Badge variant={alert.status === 'À faire' ? 'destructive' : 'default'} className={cn("h-5 px-1.5 text-[10px] w-[80px] flex justify-center", alert.status === 'Bientôt' && 'bg-blue-100 text-blue-800 hover:bg-blue-100/80')}>
                                                    {alert.status}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                         {maintenanceAlerts.length > 5 && (
                            <div className="text-center mt-2">
                                <Link href="/dashboard/cars" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs")}>
                                    et {maintenanceAlerts.length - 5} autre(s)...
                                </Link>
                            </div>
                        )}
                    </div>
                   ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                        <p className="text-muted-foreground text-sm">Aucune alerte d'entretien pour le moment.</p>
                    </div>
                   )}
                </CardContent>
            </Card>

            {/* Alertes Documents */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TriangleAlert className="h-5 w-5 text-destructive" />
                        <span>Alertes Documents</span>
                    </CardTitle>
                    <CardDescription>
                        Véhicules avec documents expirés ou expirant bientôt.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   {expiringDocuments.length > 0 ? (
                    <div className="space-y-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-[12px] font-bold">Véhicule</TableHead>
                                    <TableHead className="text-[12px] font-bold">Document</TableHead>
                                    <TableHead className="text-right text-[12px] font-bold">Expire le</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {expiringDocuments.slice(0, 5).map((alert, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="text-[12px]">
                                            <div className="font-medium">{alert.car.marque} {alert.car.modele}</div>
                                            <div className="text-[11px] text-muted-foreground">
                                                {alert.car.immat}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-[12px]">{alert.documentName}</TableCell>
                                        <TableCell className="text-right text-[12px]">
                                            <div className="flex flex-col items-end">
                                                <span>{format(alert.expiryDate, "dd/MM/yyyy", { locale: fr })}</span>
                                                <Badge variant={alert.status === 'Expiré' ? 'destructive' : 'default'} className={cn("h-5 px-2 text-[10px] w-[95px] flex justify-center", alert.status === 'Expire bientôt' && 'bg-accent text-accent-foreground hover:bg-accent/80')}>
                                                    {alert.status}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                         {expiringDocuments.length > 5 && (
                            <div className="text-center mt-2">
                                <Link href="/dashboard/cars" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs")}>
                                    et {expiringDocuments.length - 5} autre(s)...
                                </Link>
                            </div>
                        )}
                    </div>
                   ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                        <p className="text-muted-foreground text-sm">Aucune alerte de document pour le moment.</p>
                    </div>
                   )}
                </CardContent>
            </Card>
        </div>
      </div>
      )}
    </>
  );
}
