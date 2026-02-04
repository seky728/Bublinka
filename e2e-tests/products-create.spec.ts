import { test, expect } from './fixtures';
import { ItemDefinitionCategory } from '@prisma/client';

test('create product with material ingredient', async ({ productsPage, db }) => {
  // Seed: Create a catalog item (Material) named "Dubová Deska 18mm"
  const material = await db.itemDefinition.create({
    data: {
      name: 'Dubová Deska 18mm',
      category: ItemDefinitionCategory.SHEET_MATERIAL,
      description: 'Test material for product creation',
    },
  });

  const materialId = material.id;

  // Navigate to the Products page
  await productsPage.goto();

  // Create the product using the high-level method
  await productsPage.createProduct({
    name: 'Stůl Dubový',
    sellingPrice: 5000,
    ingredients: [
      {
        materialName: 'Dubová Deska 18mm',
        quantity: 1,
        width: 1000,
        height: 500,
      },
    ],
  });

  // Wait for the product to appear in the list/UI
  await productsPage.verifyProductVisible('Stůl Dubový');

  // UI Assertions: Verify the product card displays correct data
  await productsPage.verifyProductCard('Stůl Dubový', {
    price: 5000,
    ingredientName: 'Dubová Deska 18mm',
    ingredientDimensions: {
      width: 1000,
      height: 500,
    },
    ingredientQuantity: 1,
  });

  // Double Check: Use db.product.findFirst to verify it was actually saved to the DB
  const savedProduct = await db.product.findFirst({
    where: {
      name: 'Stůl Dubový',
    },
    include: {
      ingredients: {
        include: {
          itemDefinition: true,
        },
      },
    },
  });

  expect(savedProduct).not.toBeNull();
  expect(savedProduct?.name).toBe('Stůl Dubový');
  expect(savedProduct?.sellingPrice).toBe(5000);

  // Verify the ingredient was saved with correct dimensions
  expect(savedProduct?.ingredients).toHaveLength(1);
  const ingredient = savedProduct?.ingredients[0];
  expect(ingredient?.itemDefinitionId).toBe(materialId);
  expect(ingredient?.width).toBe(1000);
  expect(ingredient?.height).toBe(500);
  expect(ingredient?.quantity).toBe(1);
  expect(ingredient?.itemDefinition?.name).toBe('Dubová Deska 18mm');
});
