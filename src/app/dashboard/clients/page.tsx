
import { DashboardHeader } from "@/components/dashboard-header";
import ClientTable from "@/components/clients/client-table";
import { getClients } from "@/lib/mock-data";

export default async function ClientsPage() {
  const clients = await getClients();

  return (
    <>
      <DashboardHeader title="Clients" description="Gérez les informations de vos clients." />
      <ClientTable clients={clients} />
    </>
  );
}
