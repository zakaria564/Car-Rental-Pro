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
 * Récupère une date de location de manière robuste, en gérant les champs imbriqués
 * et les champs "à plat" (dotted keys) qui peuvent exister suite à des erreurs de synchro.
 */
export const getRentalDate = (rental: any, field: 'dateDebut' | 'dateFin'): Date | null => {
    if (!rental || !rental.location) return null;
    
    // On vérifie d'abord le champ à plat (souvent le plus récent suite à un prolongement)
    const flatKey = `location.${field}`;
    const value = rental[flatKey] ?? rental.location[field];
    
    return getSafeDate(value);
};

/**
 * Calcule le montant total d'une location.
 * Priorise le montant total enregistré en base pour éviter les erreurs d'arrondi ou de calcul de jours.
 */
export const calculateTotalRentalAmount = (rental: any): number => {
    if (!rental || !rental.location) return 0;

    // 1. Vérifier si un montant total est déjà explicitement enregistré (priorité absolue)
    const montantTotal = rental['location.montantTotal'] ?? rental.location.montantTotal;
    
    if (typeof montantTotal === 'number' && !isNaN(montantTotal) && montantTotal > 0) {
      return montantTotal;
    }

    // 2. Calculer basé sur les dates si le montant n'est pas enregistré
    const from = getRentalDate(rental, 'dateDebut');
    const to = getRentalDate(rental, 'dateFin');
    const pricePerDay = rental['location.prixParJour'] ?? rental.location.prixParJour ?? 0;

    if (from && to && pricePerDay > 0) {
        const daysDiff = differenceInCalendarDays(startOfDay(to), startOfDay(from));
        // Si même jour, on compte 1 jour minimum
        const rentalDays = daysDiff <= 0 ? 1 : daysDiff;
        return rentalDays * pricePerDay;
    }

    // 3. Repli sur le nombre de jours enregistré
    const nbrJours = rental['location.nbrJours'] ?? rental.location.nbrJours;
    if (nbrJours && pricePerDay > 0) {
      return nbrJours * pricePerDay;
    }
    
    return 0;
};
