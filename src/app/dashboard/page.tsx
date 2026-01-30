'use client';
import { Car, KeyRound, TriangleAlert, Wrench } from "lucide-react";
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
import { differenceInDays, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

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


  const activeRentals = rentals.filter(r => r.statut === 'en_cours').length;
  const availableCars = cars.filter(c => c.disponibilite === 'disponible').length;
  
  const expiringDocuments = React.useMemo(() => {
    const today = new Date();
    const alerts: { car: CarType, documentName: string, expiryDate: Date, status: 'Expiré' | 'Expire bientôt' }[] = [];

    cars.forEach(car => {
        const assuranceDate = car.dateExpirationAssurance?.toDate ? car.dateExpirationAssurance.toDate() : null;
        if (assuranceDate) {
            const daysDiff = differenceInDays(assuranceDate, today);
            if (daysDiff < 0) {
                alerts.push({ car, documentName: 'Assurance', expiryDate: assuranceDate, status: 'Expiré' });
            } else if (daysDiff <= 7) {
                alerts.push({ car, documentName: 'Assurance', expiryDate: assuranceDate, status: 'Expire bientôt' });
            }
        }

        const visiteDate = car.dateProchaineVisiteTechnique?.toDate ? car.dateProchaineVisiteTechnique.toDate() : null;
        if (visiteDate) {
            const daysDiff = differenceInDays(visiteDate, today);
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
    const today = new Date();

    cars.forEach(car => {
        const { kilometrage, maintenanceSchedule } = car;
        if (!maintenanceSchedule) return;

        // Mileage-based alerts
        if (maintenanceSchedule.prochainVidangeKm) {
            const diff = maintenanceSchedule.prochainVidangeKm - kilometrage;
            if (diff <= 0) {
                alerts.push({ car, alertType: "Vidange", value: `${maintenanceSchedule.prochainVidangeKm.toLocaleString()} km`, currentValue: `${kilometrage.toLocaleString()} km`, status: 'À faire' });
            } else if (diff <= 1000) {
                alerts.push({ car, alertType: "Vidange", value: `${maintenanceSchedule.prochainVidangeKm.toLocaleString()} km`, currentValue: `${kilometrage.toLocaleString()} km`, status: 'Bientôt' });
            }
        }
        if (maintenanceSchedule.prochainFiltreGasoilKm) {
            const diff = maintenanceSchedule.prochainFiltreGasoilKm - kilometrage;
            if (diff <= 0) {
                alerts.push({ car, alertType: "Filtre à gazole", value: `${maintenanceSchedule.prochainFiltreGasoilKm.toLocaleString()} km`, currentValue: `${kilometrage.toLocaleString()} km`, status: 'À faire' });
            } else if (diff <= 2000) {
                alerts.push({ car, alertType: "Filtre à gazole", value: `${maintenanceSchedule.prochainFiltreGasoilKm.toLocaleString()} km`, currentValue: `${kilometrage.toLocaleString()} km`, status: 'Bientôt' });
            }
        }
        if (maintenanceSchedule.prochaineCourroieKm) {
            const diff = maintenanceSchedule.prochaineCourroieKm - kilometrage;
            if (diff <= 0) {
                alerts.push({ car, alertType: "Courroie de distribution", value: `${maintenanceSchedule.prochaineCourroieKm.toLocaleString()} km`, currentValue: `${kilometrage.toLocaleString()} km`, status: 'À faire' });
            } else if (diff <= 2000) {
                alerts.push({ car, alertType: "Courroie de distribution", value: `${maintenanceSchedule.prochaineCourroieKm.toLocaleString()} km`, currentValue: `${kilometrage.toLocaleString()} km`, status: 'Bientôt' });
            }
        }
        if (maintenanceSchedule.prochainPlaquettesFreinKm) {
            const diff = maintenanceSchedule.prochainPlaquettesFreinKm - kilometrage;
            if (diff <= 0) {
                alerts.push({ car, alertType: "Plaquettes de frein", value: `${maintenanceSchedule.prochainPlaquettesFreinKm.toLocaleString()} km`, currentValue: `${kilometrage.toLocaleString()} km`, status: 'À faire' });
            } else if (diff <= 1500) {
                alerts.push({ car, alertType: "Plaquettes de frein", value: `${maintenanceSchedule.prochainPlaquettesFreinKm.toLocaleString()} km`, currentValue: `${kilometrage.toLocaleString()} km`, status: 'Bientôt' });
            }
        }
        
        // Date-based alerts
        const revisionDate = maintenanceSchedule.prochaineRevisionDate?.toDate ? maintenanceSchedule.prochaineRevisionDate.toDate() : null;
        if (revisionDate) {
            const daysDiff = differenceInDays(revisionDate, today);
            if (daysDiff < 0) {
                alerts.push({ car, alertType: "Révision générale", value: format(revisionDate, "dd/MM/yyyy"), currentValue: '', status: 'À faire' });
            } else if (daysDiff <= 15) {
                alerts.push({ car, alertType: "Révision générale", value: format(revisionDate, "dd/MM/yyyy"), currentValue: '', status: 'Bientôt' });
            }
        }
        const liquideFreinDate = maintenanceSchedule.prochainLiquideFreinDate?.toDate ? maintenanceSchedule.prochainLiquideFreinDate.toDate() : null;
        if (liquideFreinDate) {
            const daysDiff = differenceInDays(liquideFreinDate, today);
            if (daysDiff < 0) {
                alerts.push({ car, alertType: "Liquide de frein", value: format(liquideFreinDate, "dd/MM/yyyy"), currentValue: '', status: 'À faire' });
            } else if (daysDiff <= 30) {
                alerts.push({ car, alertType: "Liquide de frein", value: format(liquideFreinDate, "dd/MM/yyyy"), currentValue: '', status: 'Bientôt' });
            }
        }
         const liquideRefroidissementDate = maintenanceSchedule.prochainLiquideRefroidissementDate?.toDate ? maintenanceSchedule.prochainLiquideRefroidissementDate.toDate() : null;
        if (liquideRefroidissementDate) {
            const daysDiff = differenceInDays(liquideRefroidissementDate, today);
            if (daysDiff < 0) {
                alerts.push({ car, alertType: "Liquide de refroidissement", value: format(liquideRefroidissementDate, "dd/MM/yyyy"), currentValue: '', status: 'À faire' });
            } else if (daysDiff <= 30) {
                alerts.push({ car, alertType: "Liquide de refroidissement", value: format(liquideRefroidissementDate, "dd/MM/yyyy"), currentValue: '', status: 'Bientôt' });
            }
        }
    });

    return alerts;
  }, [cars]);


  return (
    <>
      <DashboardHeader title="Tableau de bord" description="Un aperçu de votre activité de location." />
      {loading ? (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
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
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
            <StatCard title="Voitures totales" value={cars.length.toString()} icon={Car} />
            <StatCard title="Voitures disponibles" value={`${availableCars} / ${cars.length}`} icon={Car} color="text-green-500" />
            <StatCard title="Locations actives" value={activeRentals.toString()} icon={KeyRound} />
        </div>
        <div className="grid auto-rows-fr gap-4 lg:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TriangleAlert className="h-5 w-5 text-destructive" />
                        <span>Alertes Documents</span>
                    </CardTitle>
                    <CardDescription>
                        Véhicules avec documents expirés ou expirant dans les 7 prochains jours.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   {expiringDocuments.length > 0 ? (
                    <div className="space-y-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Véhicule</TableHead>
                                    <TableHead>Document</TableHead>
                                    <TableHead className="text-right">Expire le</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {expiringDocuments.slice(0, 4).map((alert, index) => (
                                    <TableRow key={index}>
                                        <TableCell>
                                            <div className="font-medium">{alert.car.marque} {alert.car.modele}</div>
                                            <div className="text-sm text-muted-foreground">
                                                {alert.car.immat}
                                            </div>
                                        </TableCell>
                                        <TableCell>{alert.documentName}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-col items-end">
                                                <span>{format(alert.expiryDate, "dd/MM/yyyy", { locale: fr })}</span>
                                                <Badge variant={alert.status === 'Expiré' ? 'destructive' : 'default'} className={cn(alert.status === 'Expire bientôt' && 'bg-accent text-accent-foreground hover:bg-accent/80')}>
                                                    {alert.status}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                         {expiringDocuments.length > 4 && (
                            <div className="text-center">
                                <Link href="/dashboard/cars" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                                    et {expiringDocuments.length - 4} autre(s)...
                                </Link>
                            </div>
                        )}
                    </div>
                   ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                        <p className="text-muted-foreground">Aucune alerte de document pour le moment.</p>
                    </div>
                   )}
                </CardContent>
            </Card>

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
                                    <TableHead>Véhicule</TableHead>
                                    <TableHead>Intervention</TableHead>
                                    <TableHead className="text-right">Échéance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {maintenanceAlerts.slice(0, 4).map((alert, index) => (
                                    <TableRow key={index}>
                                        <TableCell>
                                            <div className="font-medium">{alert.car.marque} {alert.car.modele}</div>
                                            <div className="text-sm text-muted-foreground">
                                                {alert.car.immat}
                                            </div>
                                        </TableCell>
                                        <TableCell>{alert.alertType}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-col items-end">
                                                <span>{alert.value}</span>
                                                <Badge variant={alert.status === 'À faire' ? 'destructive' : 'default'} className={cn(alert.status === 'Bientôt' && 'bg-blue-100 text-blue-800 hover:bg-blue-100/80')}>
                                                    {alert.status}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                         {maintenanceAlerts.length > 4 && (
                            <div className="text-center">
                                <Link href="/dashboard/cars" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                                    et {maintenanceAlerts.length - 4} autre(s)...
                                </Link>
                            </div>
                        )}
                    </div>
                   ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                        <p className="text-muted-foreground">Aucune alerte d'entretien pour le moment.</p>
                    </div>
                   )}
                </CardContent>
            </Card>

            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Locations récentes</CardTitle>
                </CardHeader>
                <CardContent>
                    <RentalTable rentals={rentals.slice(0, 5)} isDashboard={true} />
                </CardContent>
            </Card>
        </div>
      </div>
      )}
    </>
  );
}
