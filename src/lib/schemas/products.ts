import { z } from 'zod';

// New recipes use itemDefinitionId (catalog); legacy used inventoryItemId
const ingredientSchema = z.object({
  itemDefinitionId: z.number().int().positive('Vyberte definici položky'),
  quantity: z.number().positive('Množství musí být kladné číslo'),
  width: z.number().positive('Šířka musí být kladné číslo').optional(),
  height: z.number().positive('Výška musí být kladné číslo').optional(),
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

export const updateProductSchema = createProductSchema.extend({
  id: z.string().uuid('Neplatné ID produktu'),
});

export const deleteProductSchema = z.object({
  id: z.string().uuid('Neplatné ID produktu'),
});

export const getProductSchema = z.object({
  id: z.string().uuid('Neplatné ID produktu'),
});

// Type exports
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type IngredientInput = z.infer<typeof ingredientSchema>;
