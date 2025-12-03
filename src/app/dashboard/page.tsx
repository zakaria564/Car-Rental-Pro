
import { Car, Users, KeyRound, DollarSign } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import RentalTable from "@/components/rentals/rental-table";
import { getRentals, getCars } from "@/lib/mock-data";
import { DashboardHeader } from "@/components/dashboard-header";

export default async function DashboardPage() {
  const rentals = await getRentals();
  const cars = await getCars();
  const availableCars = cars.filter(c => c.disponible).length;
  const activeRentals = rentals.filter(r => r.statut === 'en_cours').length;
  const totalRevenue = rentals.reduce((acc, r) => acc + r.prixTotal, 0);

  return (
    <>
      <DashboardHeader title="Tableau de bord" description="Un aperçu de votre activité de location." />
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <StatCard title="Voitures totales" value={cars.length.toString()} icon={Car} />
        <StatCard title="Voitures disponibles" value={`${availableCars} / ${cars.length}`} icon={Car} color="text-green-500" />
        <StatCard title="Locations actives" value={activeRentals.toString()} icon={KeyRound} />
        <StatCard title="Revenu total (mois)" value={`${totalRevenue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`} icon={DollarSign} />
      </div>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-4">Locations récentes</h2>
        <RentalTable rentals={rentals.slice(0, 5)} isDashboard={true} />
      </div>
    </>
  );
}
