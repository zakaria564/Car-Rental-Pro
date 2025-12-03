
import type { ReactNode } from "react";

type DashboardHeaderProps = {
  title: string;
  description?: string;
  children?: ReactNode;
};

export function DashboardHeader({ title, description, children }: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between space-y-2 mb-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      <div className="flex items-center space-x-2">
        {children}
      </div>
    </div>
  );
}
