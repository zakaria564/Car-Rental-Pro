import { DashboardHeader } from "@/components/dashboard-header";
import { AccountSettings } from "@/components/settings/account-settings";
import { ThemeSwitcher } from "@/components/settings/theme-switcher";

export default function SettingsPage() {
  return (
    <>
      <DashboardHeader title="Paramètres" description="Gérez les paramètres de votre compte et de l'application." />
      <div className="grid gap-6">
        <AccountSettings />
        <ThemeSwitcher />
      </div>
    </>
  );
}
