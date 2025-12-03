
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Car, Users, KeyRound, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
  { href: '/dashboard/cars', icon: Car, label: 'Voitures' },
  { href: '/dashboard/clients', icon: Users, label: 'Clients' },
  { href: '/dashboard/rentals', icon: KeyRound, label: 'Locations' },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
            {
              'bg-muted text-primary': pathname === item.href,
            }
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
          {item.label === 'Locations' && (
             <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground hover:bg-accent">
              2
            </Badge>
          )}
        </Link>
      ))}
    </nav>
  );
}
