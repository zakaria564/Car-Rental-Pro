import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { differenceInCalendarDays, startOfDay } from "date-fns"
import type { Rental } from "./definitions"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: 'USD' | 'EUR' | 'MAD' = 'MAD') {
  const locale = currency === 'MAD' ? 'fr-MA' : (currency === 'EUR' ? 'fr-FR' : 'en-US');
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
  }).format(amount);
}

export const getSafeDate = (date: any): Date | null => {
    if (!date) return null;
    if (date instanceof Date && !isNaN(date.getTime())) return date;
    if (date.toDate && typeof date.toDate === 'function') return date.toDate();
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) return null;
    return parsedDate;
};

/**
 * Récupère une date de location de manière robuste.
 * PRIORITÉ : Structure imbriquée standard (location.dateFin).
 * REPLI : Champs "à plat" (dotted keys) qui peuvent exister suite à des erreurs de synchro.
 */
export const getRentalDate = (rental: any, field: 'dateDebut' | 'dateFin'): Date | null => {
    if (!rental) return null;
    
    // 1. Tenter la lecture standard imbriquée (Priorité)
    if (rental.location && rental.location[field]) {
        return getSafeDate(rental.location[field]);
    }
    
    // 2. Tenter la lecture du champ à plat (Legacy/Backup)
    const flatKey = `location.${field}`;
    if (rental[flatKey]) {
        return getSafeDate(rental[flatKey]);
    }
    
    return null;
};

/**
 * Calcule le montant total d'une location de manière robuste.
 * Priorise le montant enregistré dans la structure standard.
 */
export const calculateTotalRentalAmount = (rental: any): number => {
    if (!rental || !rental.location) return 0;

    // 1. Vérifier le montant standard (Priorité)
    const montantTotal = rental.location.montantTotal;
    if (typeof montantTotal === 'number' && !isNaN(montantTotal) && montantTotal > 0) {
      return montantTotal;
    }

    // 2. Vérifier le champ à plat
    const flatTotal = rental['location.montantTotal'];
    if (typeof flatTotal === 'number' && !isNaN(flatTotal) && flatTotal > 0) {
        return flatTotal;
    }

    // 3. Calcul basé sur les dates si non enregistré
    const from = getRentalDate(rental, 'dateDebut');
    const to = getRentalDate(rental, 'dateFin');
    const pricePerDay = rental.location.prixParJour ?? rental['location.prixParJour'] ?? 0;

    if (from && to && pricePerDay > 0) {
        const daysDiff = differenceInCalendarDays(startOfDay(to), startOfDay(from));
        const rentalDays = daysDiff <= 0 ? 1 : daysDiff;
        return rentalDays * pricePerDay;
    }

    return 0;
};
