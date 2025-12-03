
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
      <DashboardHeader title="Dashboard" description="An overview of your rental business." />
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <StatCard title="Total Cars" value={cars.length.toString()} icon={Car} />
        <StatCard title="Available Cars" value={`${availableCars} / ${cars.length}`} icon={Car} color="text-green-500" />
        <StatCard title="Active Rentals" value={activeRentals.toString()} icon={KeyRound} />
        <StatCard title="Total Revenue (Month)" value={`$${totalRevenue.toLocaleString()}`} icon={DollarSign} />
      </div>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-4">Recent Rentals</h2>
        <RentalTable rentals={rentals.slice(0, 5)} isDashboard={true} />
      </div>
    </>
  );
}
