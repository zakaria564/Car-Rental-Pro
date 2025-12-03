
import type { Car, Client, Rental } from '@/lib/definitions';

export const MOCK_CARS: Car[] = [
  {
    id: '1',
    marque: 'Tesla',
    modele: 'Model S',
    immat: 'TSLA-001',
    etat: 'new',
    photoURL: 'https://picsum.photos/seed/car1/600/400',
    disponible: true,
    prixParJour: 120,
    createdAt: '2023-10-26T10:00:00Z',
  },
  {
    id: '2',
    marque: 'Ford',
    modele: 'Mustang Mach-E',
    immat: 'FORD-002',
    etat: 'good',
    photoURL: 'https://picsum.photos/seed/car2/600/400',
    disponible: false,
    prixParJour: 95,
    createdAt: '2023-10-25T11:30:00Z',
  },
  {
    id: '3',
    marque: 'Porsche',
    modele: 'Taycan',
    immat: 'PORS-003',
    etat: 'good',
    photoURL: 'https://picsum.photos/seed/car3/600/400',
    disponible: true,
    prixParJour: 150,
    createdAt: '2023-10-24T14:00:00Z',
  },
  {
    id: '4',
    marque: 'Nissan',
    modele: 'Leaf',
    immat: 'NSSN-004',
    etat: 'fair',
    photoURL: 'https://picsum.photos/seed/car4/600/400',
    disponible: true,
    prixParJour: 50,
    createdAt: '2023-10-23T09:45:00Z',
  },
  {
    id: '5',
    marque: 'Audi',
    modele: 'e-tron',
    immat: 'AUDI-005',
    etat: 'new',
    photoURL: 'https://picsum.photos/seed/car5/600/400',
    disponible: true,
    prixParJour: 110,
    createdAt: '2023-10-22T16:20:00Z',
  },
  {
    id: '6',
    marque: 'Chevrolet',
    modele: 'Bolt EV',
    immat: 'CHEV-006',
    etat: 'poor',
    photoURL: 'https://picsum.photos/seed/car6/600/400',
    disponible: false,
    prixParJour: 45,
    createdAt: '2023-10-21T18:00:00Z',
  },
];

export const MOCK_CLIENTS: Client[] = [
  {
    id: '1',
    nom: 'John Doe',
    cin: 'JD123456',
    telephone: '555-0101',
    adresse: '123 Maple Street, Anytown',
    photoCIN: 'https://picsum.photos/seed/cin1/400/250',
    createdAt: '2023-09-15T08:00:00Z',
  },
  {
    id: '2',
    nom: 'Jane Smith',
    cin: 'JS654321',
    telephone: '555-0102',
    adresse: '456 Oak Avenue, Anytown',
    photoCIN: 'https://picsum.photos/seed/cin2/400/250',
    createdAt: '2023-09-18T10:30:00Z',
  },
  {
    id: '3',
    nom: 'Robert Johnson',
    cin: 'RJ789012',
    telephone: '555-0103',
    adresse: '789 Pine Lane, Anytown',
    photoCIN: 'https://picsum.photos/seed/cin3/400/250',
    createdAt: '2023-09-20T14:20:00Z',
  },
];

export const MOCK_RENTALS: Rental[] = [
  {
    id: '1',
    client: MOCK_CLIENTS[1],
    voiture: MOCK_CARS[1],
    dateDebut: '2023-11-01T10:00:00Z',
    dateFin: '2023-11-05T10:00:00Z',
    prixParJour: 95,
    prixTotal: 380,
    caution: 500,
    statut: 'en_cours',
    createdAt: '2023-10-30T12:00:00Z',
  },
  {
    id: '2',
    client: MOCK_CLIENTS[0],
    voiture: MOCK_CARS[5],
    dateDebut: '2023-10-25T14:00:00Z',
    dateFin: '2023-10-28T14:00:00Z',
    prixParJour: 45,
    prixTotal: 135,
    caution: 300,
    statut: 'terminee',
    createdAt: '2023-10-24T18:00:00Z',
  },
];

// Simulate API latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function getCars() {
  await delay(500);
  return MOCK_CARS;
}

export async function getClients() {
  await delay(500);
  return MOCK_CLIENTS;
}

export async function getRentals() {
  await delay(500);
  return MOCK_RENTALS;
}
