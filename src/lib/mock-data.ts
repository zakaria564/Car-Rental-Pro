
import type { Car, Client, Rental, Contrat } from '@/lib/definitions';

export const MOCK_CARS: Car[] = [
  {
    id: '1',
    marque: 'Tesla Model S',
    modele: 'Model S',
    immat: 'TSLA-001',
    etat: 'new',
    photoURL: 'https://picsum.photos/seed/car1/600/400',
    disponible: true,
    prixParJour: 1200,
    createdAt: '2023-10-26T10:00:00Z',
    modeleAnnee: 2021,
    couleur: 'Noir',
    nbrPlaces: 5,
    puissance: 9,
    carburantType: 'Electrique',
  },
  {
    id: '2',
    marque: 'Ford Mustang Mach-E',
    modele: 'Mustang Mach-E',
    immat: 'FORD-002',
    etat: 'good',
    photoURL: 'https://picsum.photos/seed/car2/600/400',
    disponible: false,
    prixParJour: 950,
    createdAt: '2023-10-25T11:30:00Z',
    modeleAnnee: 2022,
    couleur: 'Bleu',
    nbrPlaces: 5,
    puissance: 8,
    carburantType: 'Electrique',
  },
  {
    id: '3',
    marque: 'Kia Sportage',
    modele: 'Sportage',
    immat: '78545-A-50',
    etat: 'good',
    photoURL: 'https://picsum.photos/seed/car3/600/400',
    disponible: true,
    prixParJour: 1200,
    createdAt: '2023-10-24T14:00:00Z',
    modeleAnnee: 2019,
    couleur: 'Noir',
    nbrPlaces: 5,
    puissance: 9,
    carburantType: 'Diesel',
  },
];

export const MOCK_CLIENTS: Client[] = [
  {
    id: '1',
    nom: 'Nibou Moured',
    cin: '5A47851',
    telephone: '0652418745',
    adresse: '123 Maple Street, Anytown',
    photoCIN: 'https://picsum.photos/seed/cin1/400/250',
    createdAt: '2023-09-15T08:00:00Z',
    permisNo: '88745',
  },
  {
    id: '2',
    nom: 'Jane Smith',
    cin: 'JS654321',
    telephone: '555-0102',
    adresse: '456 Oak Avenue, Anytown',
    photoCIN: 'https://picsum.photos/seed/cin2/400/250',
    createdAt: '2023-09-18T10:30:00Z',
    permisNo: '98765',
  },
];

export const MOCK_RENTALS: Contrat[] = [
  {
    contratId: '1',
    locataire: {
      cin: '5A47851',
      nomPrenom: 'Nibou Moured',
      permisNo: '88745',
      telephone: '0652418745',
    },
    vehicule: {
      immatriculation: '78545-A-50',
      marque: 'Kia Sportage',
      modeleAnnee: 2019,
      couleur: 'Noir',
      nbrPlaces: 5,
      puissance: 9,
      carburantType: 'Diesel',
      photoURL: 'https://picsum.photos/seed/car3/600/400',
    },
    livraison: {
      dateHeure: '2019-12-30T15:07:07Z',
      kilometrage: 7200,
      carburantNiveau: 0.5,
      roueSecours: true,
      posteRadio: true,
      lavage: true,
    },
    reception: {},
    location: {
      dateDebut: '2019-12-30T15:07:07Z',
      dateFin: '2020-01-03T15:07:07Z',
      prixParJour: 1200,
      nbrJours: 4,
      montantAPayer: 4800,
    },
    statut: 'en_cours',
    createdAt: '2019-12-30T15:07:07Z',
  },
  {
    contratId: '2',
    locataire: {
        cin: 'JS654321',
        nomPrenom: 'Jane Smith',
        permisNo: '98765',
        telephone: '555-0102',
    },
    vehicule: {
        immatriculation: 'FORD-002',
        marque: 'Ford Mustang Mach-E',
        modeleAnnee: 2022,
        couleur: 'Bleu',
        nbrPlaces: 5,
        puissance: 8,
        carburantType: 'Electrique',
        photoURL: 'https://picsum.photos/seed/car2/600/400',
    },
    livraison: {
      dateHeure: '2023-10-25T14:00:00Z',
      kilometrage: 15000,
      carburantNiveau: 0.8,
      roueSecours: true,
      posteRadio: true,
      lavage: true,
    },
    reception: {
        dateHeure: '2023-10-28T14:00:00Z',
        kilometrage: 15500,
        carburantNiveau: 0.7,
    },
    location: {
        dateDebut: '2023-10-25T14:00:00Z',
        dateFin: '2023-10-28T14:00:00Z',
        prixParJour: 950,
        nbrJours: 3,
        montantAPayer: 2850,
        depot: 3000,
    },
    statut: 'terminee',
    createdAt: '2023-10-24T18:00:00Z',
  }
];

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
