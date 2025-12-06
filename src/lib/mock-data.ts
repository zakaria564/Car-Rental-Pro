
import type { Car, Client, Rental, Contrat } from '@/lib/definitions';

export const MOCK_CARS: Car[] = [];

export const MOCK_CLIENTS: Client[] = [];

export const MOCK_RENTALS: Contrat[] = [];

// Simulate API latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function getCars(): Promise<Car[]> {
  await delay(500);
  return MOCK_CARS;
}

export async function getClients(): Promise<Client[]> {
  await delay(500);
  return MOCK_CLIENTS;
}

export async function getRentals(): Promise<Rental[]> {
  await delay(500);
  return MOCK_RENTALS;
}
