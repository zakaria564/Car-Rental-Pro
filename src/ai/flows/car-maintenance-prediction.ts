'use server';

/**
 * @fileOverview Car maintenance prediction flow.
 *
 * - predictCarMaintenance - A function that predicts when a car needs maintenance based on usage and historical data.
 * - CarMaintenancePredictionInput - The input type for the predictCarMaintenance function.
 * - CarMaintenancePredictionOutput - The return type for the predictCarMaintenance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CarMaintenancePredictionInputSchema = z.object({
  carId: z.string().describe('The ID of the car to predict maintenance for.'),
  usageData: z.string().describe('The recent usage data of the car (e.g., mileage, hours driven).'),
  historicalMaintenanceData: z
    .string()
    .describe('The historical maintenance data of the car (e.g., previous repairs, maintenance dates).'),
});

export type CarMaintenancePredictionInput = z.infer<typeof CarMaintenancePredictionInputSchema>;

const CarMaintenancePredictionOutputSchema = z.object({
  needsMaintenance: z
    .boolean()
    .describe('Whether the car needs maintenance based on the provided data.'),
  reason: z.string().describe('The reason why the car needs maintenance.'),
  suggestedMaintenanceTasks: z
    .string()
    .describe('The list of suggested maintenance tasks to perform.'),
  urgency: z.string().describe('How urgent the maintenance is (e.g., low, medium, high).'),
  estimatedCost: z.number().describe('The estimated cost of the maintenance.'),
});

export type CarMaintenancePredictionOutput = z.infer<typeof CarMaintenancePredictionOutputSchema>;

export async function predictCarMaintenance(
  input: CarMaintenancePredictionInput
): Promise<CarMaintenancePredictionOutput> {
  return predictCarMaintenanceFlow(input);
}

const predictCarMaintenancePrompt = ai.definePrompt({
  name: 'predictCarMaintenancePrompt',
  input: {schema: CarMaintenancePredictionInputSchema},
  output: {schema: CarMaintenancePredictionOutputSchema},
  prompt: `You are an expert car mechanic specializing in predicting car maintenance needs.

You will use the car's usage data and historical maintenance data to predict if the car needs maintenance.

Usage Data: {{{usageData}}}
Historical Maintenance Data: {{{historicalMaintenanceData}}}

Consider the following:
- Common issues for the car's make and model
- The severity of the usage data
- The recency of the historical maintenance data

Based on this information, determine if the car needs maintenance, the reason why, suggested maintenance tasks, how urgent the maintenance is, and the estimated cost.
Set the needsMaintenance field appropriately.

Return the data as a JSON object conforming to this schema:
${CarMaintenancePredictionOutputSchema.description}`, // include schema definition
});

const predictCarMaintenanceFlow = ai.defineFlow(
  {
    name: 'predictCarMaintenanceFlow',
    inputSchema: CarMaintenancePredictionInputSchema,
    outputSchema: CarMaintenancePredictionOutputSchema,
  },
  async input => {
    const {output} = await predictCarMaintenancePrompt(input);
    return output!;
  }
);
