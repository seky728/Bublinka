import { z } from 'zod';

const itemDefinitionCategoryEnum = z.enum(
  ['SHEET_MATERIAL', 'COMPONENT', 'OTHER'],
  { error: 'Neplatná kategorie' }
);

const propertiesSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  .optional();

export const createItemDefinitionSchema = z.object({
  name: z.string().min(1, 'Název je povinný'),
  category: itemDefinitionCategoryEnum,
  description: z.string().optional().nullable(),
  properties: propertiesSchema,
});

export const updateItemDefinitionSchema = z.object({
  id: z.number().int().positive('ID musí být kladné celé číslo'),
  name: z.string().min(1, 'Název je povinný').optional(),
  category: itemDefinitionCategoryEnum.optional(),
  description: z.string().optional().nullable(),
  properties: propertiesSchema,
});

export const deleteItemDefinitionSchema = z.object({
  id: z.number().int().positive('ID musí být kladné celé číslo'),
});

export const getItemDefinitionSchema = z.object({
  id: z.number().int().positive('ID musí být kladné celé číslo'),
});

export type CreateItemDefinitionInput = z.infer<typeof createItemDefinitionSchema>;
export type UpdateItemDefinitionInput = z.infer<typeof updateItemDefinitionSchema>;
export type DeleteItemDefinitionInput = z.infer<typeof deleteItemDefinitionSchema>;
export type GetItemDefinitionInput = z.infer<typeof getItemDefinitionSchema>;
