
import { DashboardHeader } from "@/components/dashboard-header";
import CarTable from "@/components/cars/car-table";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { getCars } from "@/lib/mock-data";

export default async function CarsPage() {
  const cars = await getCars();

  return (
    <>
      <DashboardHeader title="Cars" description="Manage your fleet of vehicles.">
        {/* This button will be part of the CarTable component to handle the sheet opening */}
      </DashboardHeader>
      <CarTable cars={cars} />
    </>
  );
}
