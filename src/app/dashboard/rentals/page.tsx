
import { DashboardHeader } from "@/components/dashboard-header";
import RentalTable from "@/components/rentals/rental-table";
import { getRentals } from "@/lib/mock-data";

export default async function RentalsPage() {
  const rentals = await getRentals();

  return (
    <>
      <DashboardHeader title="Rentals" description="Manage all car rental records." />
      <RentalTable rentals={rentals} />
    </>
  );
}
