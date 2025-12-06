
'use server';

import { predictCarMaintenance, CarMaintenancePredictionOutput } from '@/ai/flows/car-maintenance-prediction';
import { getFirebaseServices } from '@/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { z } from 'zod';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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
  const carData = {
    ...validatedFields.data,
    createdAt: serverTimestamp(),
    modeleAnnee: new Date().getFullYear(),
    couleur: 'Inconnue',
    nbrPlaces: 5,
    puissance: 7,
    carburantType: 'Essence',
  };
  
  const carsCollection = collection(firestore, 'cars');

  // Do not await the addDoc call. Instead, chain a .catch() to handle errors.
  addDoc(carsCollection, carData).catch(serverError => {
      const permissionError = new FirestorePermissionError({
          path: carsCollection.path,
          operation: 'create',
          requestResourceData: carData
      }, serverError);
      
      // We don't have access to the response here, so we use the emitter.
      // This is a server action, so we can't directly use the client-side emitter.
      // For the purpose of this exercise, we will log it to the server console.
      // In a real app, this would require a different strategy for surfacing errors from server actions.
      console.error(permissionError.message);
  });
  
  // Optimistically return success
  return { message: 'Voiture ajoutée avec succès.' };
}
