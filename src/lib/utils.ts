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

export const calculateTotalRentalAmount = (rental: Rental): number => {
    const from = getSafeDate(rental.location.dateDebut);
    const to = getSafeDate(rental.location.dateFin);
    const pricePerDay = rental.location.prixParJour || 0;

    if (from && to && pricePerDay > 0) {
        const daysDiff = differenceInCalendarDays(startOfDay(to), startOfDay(from));
        // Si même jour, on compte 1 jour minimum
        const rentalDays = daysDiff <= 0 ? 1 : daysDiff;
        return rentalDays * pricePerDay;
    }

    if (typeof rental.location.montantTotal === 'number' && !isNaN(rental.location.montantTotal) && rental.location.montantTotal > 0) {
      return rental.location.montantTotal;
    }
    if (rental.location.nbrJours && pricePerDay > 0) {
      return rental.location.nbrJours * pricePerDay;
    }
    
    return 0;
};
