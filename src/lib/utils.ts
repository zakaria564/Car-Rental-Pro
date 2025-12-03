
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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
