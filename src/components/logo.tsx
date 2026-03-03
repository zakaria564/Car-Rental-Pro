'use client';

import { useFirebase } from '@/firebase';
import { Car } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Composant Logo qui affiche soit le logo personnalisé de l'agence (configuré dans les paramètres),
 * soit une icône par défaut si aucun logo n'est défini.
 */
export function Logo({ className }: { className?: string }) {
  const firebase = useFirebase();
  // Gestion sécurisée au cas où le contexte Firebase ne serait pas encore prêt
  const companySettings = firebase ? firebase.companySettings : null;
  const logoUrl = companySettings?.logoUrl;

  if (logoUrl && logoUrl.startsWith('http')) {
    return (
      <div className={cn("relative h-16 w-16 flex-shrink-0", className)}>
        <Image 
          src={logoUrl} 
          alt={companySettings?.companyName || "Logo Agence"} 
          fill 
          className="object-contain"
          priority
        />
      </div>
    );
  }

  return (
    <div className={cn("bg-primary text-primary-foreground rounded-xl p-2.5 flex-shrink-0 flex items-center justify-center h-16 w-16 shadow-md", className)}>
      <Car className="h-full w-full" />
    </div>
  );
}
