
import { DashboardHeader } from "@/components/dashboard-header";
import ClientTable from "@/components/clients/client-table";
import { getClients } from "@/lib/mock-data";

export default async function ClientsPage() {
  const clients = await getClients();

  return (
    <>
      <DashboardHeader title="Clients" description="Manage your customer information." />
      <ClientTable clients={clients} />
    </>
  );
}
