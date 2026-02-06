import type { Prisma } from '@prisma/client';

export interface IngredientForCostCalculation {
  itemDefinitionId: number;
  quantity: number;
  itemDefinition?: {
    purchasePrice: Prisma.Decimal | number | null;
  } | null;
}

/**
 * Calculate total base cost of a product based on its ingredients
 * Formula: Sum of (Ingredient Quantity * Material Purchase Price) for all ingredients
 * This is a pure function that can be used on both client and server
 * @param ingredients - Array of ingredients with itemDefinitionId, quantity, and optional itemDefinition with purchasePrice
 * @returns Total base cost in CZK (rounded to 2 decimal places)
 */
export function calculateTotalBaseCost(
  ingredients: IngredientForCostCalculation[],
): number {
  let totalCost = 0;

  for (const ingredient of ingredients) {
    // Get purchasePrice from itemDefinition if available
    const purchasePrice = ingredient.itemDefinition?.purchasePrice ?? null;

    // Convert Decimal to number if needed
    let price = 0;
    if (purchasePrice !== null) {
      if (typeof purchasePrice === 'object' && 'toNumber' in purchasePrice) {
        price = purchasePrice.toNumber();
      } else {
        price = Number(purchasePrice);
      }
    }

    // Calculate cost for this ingredient: quantity * purchasePrice
    const ingredientCost = ingredient.quantity * price;
    totalCost += ingredientCost;
  }

  // Round to 2 decimal places
  return Math.round(totalCost * 100) / 100;
}
