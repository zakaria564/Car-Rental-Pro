export const carBrands = {
  "Audi": ["A1", "A3", "A4", "A5", "A6", "Q2", "Q3", "Q5", "Q7", "e-tron"],
  "BMW": ["Série 1", "Série 2", "Série 3", "Série 4", "Série 5", "X1", "X2", "X3", "X4", "X5"],
  "Citroën": ["C3", "C3 Aircross", "C4", "C5 Aircross", "C5 X", "Berlingo", "Ami"],
  "Dacia": ["Duster", "Sandero", "Logan", "Dokker", "Spring", "Jogger"],
  "Fiat": ["500", "500X", "Panda", "Tipo", "Doblo"],
  "Ford": ["Fiesta", "Focus", "Puma", "Kuga", "Mustang Mach-E", "Explorer"],
  "Hyundai": ["i10", "i20", "i30", "Tucson", "Kona", "Santa Fe", "Creta", "Bayon"],
  "Kia": ["Picanto", "Rio", "Ceed", "Sportage", "Niro", "Seltos", "Stonic"],
  "Mercedes-Benz": ["Classe A", "Classe B", "Classe C", "Classe E", "GLA", "GLB", "GLC", "GLE", "EQC"],
  "Peugeot": ["208", "308", "408", "508", "2008", "3008", "5008", "Rifter"],
  "Renault": ["Clio", "Captur", "Megane", "Arkana", "Austral", "Kadjar", "Express"],
  "Skoda": ["Fabia", "Octavia", "Superb", "Kamiq", "Karoq", "Kodiaq", "Enyaq"],
  "Toyota": ["Yaris", "Yaris Cross", "Corolla", "C-HR", "RAV4", "Hilux"],
  "Volkswagen": ["Polo", "Golf", "T-Roc", "Tiguan", "Taigo", "Passat", "ID.3", "ID.4"],
} as const;

export type CarBrand = keyof typeof carBrands;
