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
  
  const groupedExpiringDocuments = React.useMemo(() => {
    const today = new Date();
    const carAlertsMap = new Map<string, { car: CarType, alerts: { documentName: string, expiryDate: Date, status: 'Expiré' | 'Expire bientôt' }[] }>();

    cars.forEach(car => {
        const alerts: { documentName: string, expiryDate: Date, status: 'Expiré' | 'Expire bientôt' }[] = [];
        
        const assuranceDate = getSafeDate(car.dateExpirationAssurance);
        if (assuranceDate) {
            const daysDiff = differenceInCalendarDays(assuranceDate, today);
            if (daysDiff < 0) {
                alerts.push({ documentName: 'Assurance', expiryDate: assuranceDate, status: 'Expiré' });
            } else if (daysDiff <= 7) {
                alerts.push({ documentName: 'Assurance', expiryDate: assuranceDate, status: 'Expire bientôt' });
            }
        }

        const visiteDate = getSafeDate(car.dateProchaineVisiteTechnique);
        if (visiteDate) {
            const daysDiff = differenceInCalendarDays(visiteDate, today);
            if (daysDiff < 0) {
                alerts.push({ documentName: 'Visite Technique', expiryDate: visiteDate, status: 'Expiré' });
            } else if (daysDiff <= 7) {
                alerts.push({ documentName: 'Visite Technique', expiryDate: visiteDate, status: 'Expire bientôt' });
            }
        }

        if (alerts.length > 0) {
            carAlertsMap.set(car.id, { 
                car, 
                alerts: alerts.sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime()) 
            });
        }
    });

    return Array.from(carAlertsMap.values()).sort((a, b) => {
        return a.alerts[0].expiryDate.getTime() - b.alerts[0].expiryDate.getTime();
    });
  }, [cars]);
  
 const groupedMaintenanceAlerts = React.useMemo(() => {
    const carAlertsMap = new Map<string, { car: CarType, alerts: { alertType: string, value: string, currentValue: string, status: 'À faire' | 'Bientôt' }[] }>();

    cars.forEach(car => {
        const alerts: { alertType: string, value: string, currentValue: string, status: 'À faire' | 'Bientôt' }[] = [];
        const { kilometrage, maintenanceSchedule } = car;
        if (!maintenanceSchedule) return;

        const checkKmAlert = (nextKm: number | undefined, type: string, soonThreshold: number = 1000) => {
            if (typeof nextKm !== 'number') return;
            const diff = nextKm - kilometrage;
            if (diff <= 0) {
                alerts.push({ alertType: type, value: `${nextKm.toLocaleString()} km`, currentValue: `${kilometrage.toLocaleString()} km`, status: 'À faire' });
            } else if (diff <= soonThreshold) {
                alerts.push({ alertType: type, value: `${nextKm.toLocaleString()} km`, currentValue: `${kilometrage.toLocaleString()} km`, status: 'Bientôt' });
            }
        };

        checkKmAlert(maintenanceSchedule.prochainVidangeKm, "Vidange");
        checkKmAlert(maintenanceSchedule.prochainFiltreGasoilKm, "Filtre à gazole", 2000);
        checkKmAlert(maintenanceSchedule.prochainesPlaquettesFreinKm, "Plaquettes de frein", 2000);
        checkKmAlert(maintenanceSchedule.prochaineCourroieDistributionKm, "Courroie de distribution", 5000);

        if (alerts.length > 0) {
            carAlertsMap.set(car.id, { 
                car, 
                alerts: alerts.sort((a, b) => {
                    if (a.status === 'À faire' && b.status !== 'À faire') return -1;
                    if (a.status !== 'À faire' && b.status === 'À faire') return 1;
                    return 0;
                }) 
            });
        }
    });

    return Array.from(carAlertsMap.values()).sort((a, b) => {
        const aHasAFaire = a.alerts.some(al => al.status === 'À faire');
        const bHasAFaire = b.alerts.some(al => al.status === 'À faire');
        if (aHasAFaire && !bHasAFaire) return -1;
        if (!aHasAFaire && bHasAFaire) return 1;
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
                   {groupedMaintenanceAlerts.length > 0 ? (
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
                                {groupedMaintenanceAlerts.slice(0, 5).map((group, groupIndex) => (
                                    <TableRow key={groupIndex}>
                                        <TableCell className="text-[12px] align-top py-4">
                                            <div className="font-medium">{group.car.marque} {group.car.modele}</div>
                                            <div className="text-[11px] text-muted-foreground">
                                                {group.car.immat}
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-0 align-top" colSpan={3}>
                                            <div className="flex flex-col divide-y divide-border/50">
                                                {group.alerts.map((alert, alertIndex) => (
                                                    <div key={alertIndex} className="grid grid-cols-3 gap-4 py-3 px-4">
                                                        <div className="text-[12px] flex items-center">{alert.alertType}</div>
                                                        <div className="text-[12px] text-center flex items-center justify-center">{alert.currentValue}</div>
                                                        <div className="flex flex-col items-end text-[12px]">
                                                            <span className="font-semibold">{alert.value}</span>
                                                            <Badge variant={alert.status === 'À faire' ? 'destructive' : 'default'} className={cn("h-5 px-1.5 text-[10px] w-[80px] flex justify-center mt-0.5", alert.status === 'Bientôt' && 'bg-amber-500 text-white hover:bg-amber-600 border-none')}>
                                                                {alert.status}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                         {groupedMaintenanceAlerts.length > 5 && (
                            <div className="text-center mt-2">
                                <Link href="/dashboard/cars" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs")}>
                                    et {groupedMaintenanceAlerts.length - 5} autre(s) véhicule(s)...
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
                   {groupedExpiringDocuments.length > 0 ? (
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
                                {groupedExpiringDocuments.slice(0, 5).map((group, groupIndex) => (
                                    <TableRow key={groupIndex}>
                                        <TableCell className="text-[12px] align-top py-4">
                                            <div className="font-medium">{group.car.marque} {group.car.modele}</div>
                                            <div className="text-[11px] text-muted-foreground">
                                                {group.car.immat}
                                            </div>
                                        </TableCell>
                                        <TableCell className="p-0 align-top" colSpan={2}>
                                            <div className="flex flex-col divide-y divide-border/50">
                                                {group.alerts.map((alert, alertIndex) => (
                                                    <div key={alertIndex} className="grid grid-cols-2 gap-4 py-3 px-4">
                                                        <div className="text-[12px] flex items-center">{alert.documentName}</div>
                                                        <div className="flex flex-col items-end text-[12px]">
                                                            <span>{format(alert.expiryDate, "dd/MM/yyyy", { locale: fr })}</span>
                                                            <Badge variant={alert.status === 'Expiré' ? 'destructive' : 'default'} className={cn("h-5 px-2 text-[10px] w-[95px] flex justify-center mt-0.5", alert.status === 'Expire bientôt' && 'bg-amber-500 text-white hover:bg-amber-600 border-none')}>
                                                                {alert.status}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                         {groupedExpiringDocuments.length > 5 && (
                            <div className="text-center mt-2">
                                <Link href="/dashboard/cars" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs")}>
                                    et {groupedExpiringDocuments.length - 5} autre(s) véhicule(s)...
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
