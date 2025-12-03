
'use server';

import { predictCarMaintenance, CarMaintenancePredictionOutput } from '@/ai/flows/car-maintenance-prediction';
import { z } from 'zod';

const MaintenanceSchema = z.object({
  carId: z.string(),
  usageData: z.string().min(10, { message: "Please provide more details on usage." }),
  historicalMaintenanceData: z.string().min(10, { message: "Please provide more details on maintenance history." }),
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
      message: 'Validation Error: Please check the fields.',
    };
  }

  try {
    const result = await predictCarMaintenance(validatedFields.data);
    return { message: 'Success', data: result };
  } catch (error) {
    console.error(error);
    return { message: 'API Error: Failed to get maintenance prediction.' };
  }
}
