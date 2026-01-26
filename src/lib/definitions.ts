
export type Car = {
  id: string;
  marque: string;
  modele: string;
  immat: string;
  numChassis: string;
  etat: 'new' | 'good' | 'fair' | 'poor';
  photoURL: string;
  disponible: boolean;
  prixParJour: number;
  createdAt: any; // Can be Timestamp
  dateMiseEnCirculation: any; // Can be Timestamp
  kilometrage: number;
  couleur: string;
  nbrPlaces: number;
  puissance: number;
  carburantType: 'Diesel' | 'Essence' | 'Electrique';
  transmission: 'Manuelle' | 'Automatique';
  dateExpirationAssurance?: any;
  dateProchaineVisiteTechnique?: any;
  anneeVignette?: number;
  maintenanceHistory?: string;
};

export type Client = {
  id: string;
  nom: string;
  cin: string;
  telephone: string;
  adresse: string;
  photoCIN: string;
  createdAt: any; // Can be Timestamp
  permisNo?: string;
};

export const damageTypes = {
  R: { label: 'Rayure', color: 'bg-yellow-400/70 border-yellow-500' },
  E: { label: 'Éclat / Bosse', color: 'bg-orange-500/70 border-orange-600' },
  C: { label: 'Cassure', color: 'bg-red-600/70 border-red-700' },
  X: { label: 'À remplacer', color: 'bg-gray-800/80 border-gray-900 text-white' },
} as const;

export type DamageType = keyof typeof damageTypes;

export type Damage = {
  id: string;
  partName: string;
  damageType: DamageType;
  photoURL?: string;
  positionX: number;
  positionY: number;
};

export type Inspection = {
  id:string;
  vehicleId: string;
  rentalId: string;
  userId: string;
  timestamp: any; // Timestamp
  type: 'depart' | 'retour';
  notes?: string;
  kilometrage: number;
  carburantNiveau: number;
  roueSecours: boolean;
  posteRadio: boolean;
  lavage: boolean;
  cric: boolean;
  giletTriangle: boolean;
  doubleCles: boolean;
  photos?: string[];
  damages: Damage[]; // This will be populated from the subcollection for UI purposes
};

export type Rental = {
  id: string;
  locataire: {
    cin: string;
    nomPrenom: string;
    permisNo: string;
    telephone: string;
  };
  conducteur2?: {
    cin: string;
    nomPrenom: string;
    permisNo: string;
    telephone: string;
  };
  vehicule: {
    carId: string;
    immatriculation: string;
    marque: string;
    dateMiseEnCirculation: any; // Can be Timestamp
    couleur: string;
    nbrPlaces: number;
    puissance: number;
    carburantType: string;
    transmission: string;
    photoURL: string;
  };
  livraisonInspectionId?: string;
  receptionInspectionId?: string;

  // Deprecated but kept for backward compatibility
  livraison?: {
    dateHeure: any; // Timestamp
    kilometrage: number;
    carburantNiveau: number;
    roueSecours: boolean;
    posteRadio: boolean;
    lavage: boolean;
    cric: boolean;
    giletTriangle: boolean;
    doubleCles: boolean;
    dommages: { [key: string]: DamageType };
    dommagesNotes?: string;
    photos?: string[];
  };
  reception?: {
    dateHeure?: any; // Timestamp
    kilometrage?: number;
    carburantNiveau?: number;
    roueSecours?: boolean;
    posteRadio?: boolean;
    lavage?: boolean;
    cric: boolean;
    giletTriangle: boolean;
    doubleCles: boolean;
    dommages?: { [key: string]: DamageType };
    dommagesNotes?: string;
    photos?: string[];
  };

  location: {
    dateDebut: any; // Timestamp
    dateFin: any; // Timestamp
    prixParJour: number;
    nbrJours: number;
    depot?: number;
    montantAPayer: number;
  };
  statut: 'en_cours' | 'terminee';
  createdAt: any; // Timestamp
};

export type Contrat = Rental;
