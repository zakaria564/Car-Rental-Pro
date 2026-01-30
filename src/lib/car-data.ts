
export const carBrands = {
  "Audi": ["A1", "A3", "Q2", "Q3"],
  "BMW": ["Série 1", "Série 3", "X1", "X3"],
  "Citroën": ["C3", "C4", "C5 Aircross"],
  "Dacia": ["Duster", "Sandero", "Logan", "Dokker", "Spring"],
  "Fiat": ["500", "Panda", "Tipo"],
  "Ford": ["Fiesta", "Focus", "Puma", "Kuga"],
  "Hyundai": ["i10", "i20", "Tucson", "Creta"],
  "Kia": ["Picanto", "Rio", "Sportage", "Seltos"],
  "Mercedes-Benz": ["Classe A", "Classe C", "GLA", "GLC"],
  "Peugeot": ["208", "308", "2008", "3008", "5008"],
  "Renault": ["Clio", "Captur", "Megane", "Kadjar", "Arkana"],
  "Skoda": ["Fabia", "Octavia", "Kamiq", "Karoq", "Kodiaq"],
  "Toyota": ["Yaris", "Corolla", "C-HR", "RAV4"],
  "Volkswagen": ["Polo", "Golf", "T-Roc", "Tiguan", "Passat"],
} as const;

export type CarBrand = keyof typeof carBrands;
