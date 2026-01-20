
'use server';

/**
 * @fileOverview Generates an image of a car based on its properties.
 *
 * - generateCarImage - A function that generates an image of a car.
 * - GenerateCarImageInput - The input type for the generateCarImage function.
 * - GenerateCarImageOutput - The return type for the generateCarImage function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateCarImageInputSchema = z.object({
  marque: z.string().describe('The make of the car (e.g., Tesla).'),
  modele: z.string().describe('The model of the car (e.g., Model S).'),
  annee: z.number().describe('The model year of the car (e.g., 2023).'),
  couleur: z.string().describe('The color of the car (e.g., Red).'),
});

export type GenerateCarImageInput = z.infer<typeof GenerateCarImageInputSchema>;

const GenerateCarImageOutputSchema = z.object({
  imageUrl: z.string().describe("The data URI of the generated car image, in PNG format. Expected format: 'data:image/png;base64,<encoded_data>'."),
});

export type GenerateCarImageOutput = z.infer<typeof GenerateCarImageOutputSchema>;

export async function generateCarImage(
  input: GenerateCarImageInput
): Promise<GenerateCarImageOutput> {
  return generateCarImageFlow(input);
}

const generateCarImagePrompt = ai.definePrompt(
  {
    name: 'generateCarImagePrompt',
    input: { schema: GenerateCarImageInputSchema },
    prompt: `Generate a photorealistic image of a {{couleur}} {{marque}} {{modele}} from the year {{annee}}. The car should be the main subject, clean, and parked in a neutral, outdoor setting like a clean parking lot or a modern street during the day. The image should look like a professional photograph for a car rental website.`,
  }
);

const generateCarImageFlow = ai.defineFlow(
  {
    name: 'generateCarImageFlow',
    inputSchema: GenerateCarImageInputSchema,
    outputSchema: GenerateCarImageOutputSchema,
  },
  async (input) => {
    const promptText = await generateCarImagePrompt.render({ input });
    const { media } = await ai.generate({
        model: 'googleai/imagen-4.0-fast-generate-001',
        prompt: promptText.prompt,
    });
    
    const imageUrl = media.url;
    if (!imageUrl) {
        throw new Error('Image generation failed to return a data URI.');
    }

    return { imageUrl };
  }
);
