
'use server';

import { predictCarMaintenance, CarMaintenancePredictionOutput } from '@/ai/flows/car-maintenance-prediction';
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
