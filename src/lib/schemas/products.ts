import { z } from 'zod';

// Validation schemas
const ingredientSchema = z.object({
  inventoryItemId: z.string().uuid('Neplatné ID položky skladu'),
  quantity: z.number().positive('Množství musí být kladné číslo'),
});

export const createProductSchema = z.object({
  name: z.string().min(1, 'Název je povinný'),
  description: z.string().optional(),
  sellingPrice: z.number().positive('Cena musí být kladné číslo'),
  productionSteps: z.string().optional(),
  // photoUrl now stores the file path (not a URL) - signed URLs are generated when fetching
  photoUrl: z.string().optional().or(z.literal('')),
  ingredients: z
    .array(ingredientSchema)
    .min(1, 'Produkt musí mít alespoň jednu ingredienci'),
});

export const deleteProductSchema = z.object({
  id: z.string().uuid('Neplatné ID produktu'),
});

// Type exports
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type IngredientInput = z.infer<typeof ingredientSchema>;
