
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
};

export type Client = {
  id: string;
  nom: string;
  cin: string;
  telephone: string;
  adresse: string;
  photoCIN: string;
  createdAt: string;
};

export type Rental = {
  id: string;
  client: Client;
  voiture: Car;
  dateDebut: string;
  dateFin: string;
  prixParJour: number;
  prixTotal: number;
  caution: number;
  statut: 'en_cours' | 'terminee';
  createdAt: string;
};
