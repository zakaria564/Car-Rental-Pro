
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
    photoURL: string;
  };
  livraison: {
    dateHeure: any; // Timestamp
    kilometrage: number;
    carburantNiveau: number;
    roueSecours: boolean;
    posteRadio: boolean;
    lavage: boolean;
    dommages: string[];
    dommagesNotes?: string;
  };
  reception: {
    dateHeure?: any; // Timestamp
    kilometrage?: number;
    carburantNiveau?: number;
    roueSecours?: boolean;
    posteRadio?: boolean;
    lavage?: boolean;
    dommages?: string[];
    dommagesNotes?: string;
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

    
