'use server';

import { generateCarImage, GenerateCarImageInput } from '@/ai/flows/generate-car-image';
import { z } from 'zod';

const GenerateImageSchema = z.object({
    marque: z.string(),
    modele: z.string(),
    annee: z.coerce.number(),
    couleur: z.string(),
});

export async function generateCarImageAction(input: GenerateCarImageInput): Promise<{imageUrl: string | null, error: string | null}> {
    const validatedFields = GenerateImageSchema.safeParse(input);
    if (!validatedFields.success) {
        return { imageUrl: null, error: "Invalid input." };
    }

    try {
        const result = await generateCarImage(validatedFields.data);
        return { imageUrl: result.imageUrl, error: null };
    } catch (error) {
        console.error("AI Image Generation Error:", error);
        return { imageUrl: null, error: "Failed to generate car image." };
    }
}
