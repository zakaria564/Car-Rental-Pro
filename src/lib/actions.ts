
'use server';

import { predictCarMaintenance, CarMaintenancePredictionOutput } from '@/ai/flows/car-maintenance-prediction';
import { getFirebaseServices } from '@/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { z } from 'zod';

const MaintenanceSchema = z.object({
  carId: z.string(),
  usageData: z.string().min(10, { message: "Veuillez fournir plus de détails sur l'utilisation." }),
  historicalMaintenanceData: z.string().min(10, { message: "Veuillez fournir plus de détails sur l'historique de l'entretien." }),
});

export type MaintenanceState = {
  errors?: {
    usageData?: string[];
    historicalMaintenanceData?: string[];
  };
  message?: string | null;
  data?: CarMaintenancePredictionOutput | null;
};

export async function checkMaintenance(
  prevState: MaintenanceState,
  formData: FormData
): Promise<MaintenanceState> {
  const validatedFields = MaintenanceSchema.safeParse({
    carId: formData.get('carId'),
    usageData: formData.get('usageData'),
    historicalMaintenanceData: formData.get('historicalMaintenanceData'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Erreur de validation : Veuillez vérifier les champs.',
    };
  }

  try {
    const result = await predictCarMaintenance(validatedFields.data);
    return { message: 'Success', data: result };
  } catch (error) {
    console.error(error);
    return { message: "Erreur d'API : Impossible d'obtenir la prédiction de l'entretien." };
  }
}

const carFormSchema = z.object({
  marque: z.string().min(2, "La marque doit comporter au moins 2 caractères."),
  modele: z.string().min(1, "Le modèle est requis."),
  immat: z.string().min(5, "La plaque d'immatriculation semble trop courte."),
  prixParJour: z.coerce.number().min(1, "Le prix doit être supérieur à 0."),
  etat: z.enum(["new", "good", "fair", "poor"]),
  disponible: z.boolean().default(true),
  photoURL: z.string().url("L'URL de la photo n'est pas valide").optional(),
});

export async function addCar(data: unknown) {
  const validatedFields = carFormSchema.safeParse(data);

  if (!validatedFields.success) {
    console.error('Validation failed', validatedFields.error.flatten().fieldErrors);
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Erreur de validation.',
    };
  }

  const { firestore } = getFirebaseServices();

  try {
    await addDoc(collection(firestore, 'cars'), {
      ...validatedFields.data,
      createdAt: new Date().toISOString(),
      // Add other default fields from Car definition if needed
      modeleAnnee: new Date().getFullYear(),
      couleur: 'Inconnue',
      nbrPlaces: 5,
      puissance: 7,
      carburantType: 'Essence',
    });
    return { message: 'Voiture ajoutée avec succès.' };
  } catch (e) {
    console.error(e);
    return { message: 'Erreur lors de l\'ajout de la voiture.' };
  }
}
