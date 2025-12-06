

export type Car = {
  id: string;
  marque: string;
  modele: string;
  immat: string;
  etat: 'new' | 'good' | 'fair' | 'poor';
  photoURL: string;
  disponible: boolean;
  prixParJour: number;
  createdAt: string;
  modeleAnnee: number;
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
  createdAt: string;
  permisNo?: string;
};

export type Contrat = {
  id?: string;
  contratId?: string;
  locataire: {
    cin: string;
    nomPrenom: string;
    permisNo: string;
    telephone: string;
    deuxiemeChauffeur?: string;
  };
  vehicule: {
    immatriculation: string;
    marque: string;
    modeleAnnee: number;
    couleur: string;
    nbrPlaces: number;
    puissance: number;
    carburantType: 'Diesel' | 'Essence' | 'Electrique';
    photoURL: string;
  };
  livraison: {
    dateHeure: string; // Should be Timestamp
    kilometrage: number;
    carburantNiveau: number; // Float (0 to 1)
    roueSecours: boolean;
    posteRadio: boolean;
    lavage: boolean;
    dommages?: string[];
    dommagesNotes?: string;
  };
  reception: {
    dateHeure?: string; // Should be Timestamp
    kilometrage?: number;
    carburantNiveau?: number;
    dommages?: string[];
    dommagesNotes?: string;
  };
  location: {
    dateDebut: string;
    dateFin: string;
    prixParJour: number;
    nbrJours: number;
    depot?: number;
    montantAPayer: number;
  };
  statut: 'en_cours' | 'terminee';
  createdAt: string;
};

export type Rental = Contrat; // Alias for backward compatibility
