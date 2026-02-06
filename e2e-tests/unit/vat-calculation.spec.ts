import { test, expect } from '../fixtures';
import { calculatePrice } from '@/lib/pricing';
import { calculateTotalBaseCost } from '@/lib/pricing-utils';
import { Prisma } from '@prisma/client';

test.describe('VAT Calculation', () => {
  test('should select correct rate based on date', async ({ db }) => {
    // Seed two STANDARD rates with different validity periods
    await db.vatRate.create({
      data: {
        code: 'STANDARD',
        name: 'Základní sazba (stará)',
        percentage: 20.0,
        validFrom: new Date('2020-01-01T00:00:00Z'),
        validTo: new Date('2023-12-31T23:59:59Z'),
      },
    });

    await db.vatRate.create({
      data: {
        code: 'STANDARD',
        name: 'Základní sazba (nová)',
        percentage: 21.0,
        validFrom: new Date('2024-01-01T00:00:00Z'),
        validTo: null,
      },
    });

    // Test with date in 2023 - should use 20%
    const result2023 = await calculatePrice(100, 'STANDARD', new Date('2023-06-15'));
    expect(result2023.rateUsed).toBe(20);
    expect(result2023.vatAmount).toBe(20.0);
    expect(result2023.totalWithVat).toBe(120.0);

    // Test with date in 2024 - should use 21%
    const result2024 = await calculatePrice(100, 'STANDARD', new Date('2024-06-15'));
    expect(result2024.rateUsed).toBe(21);
    expect(result2024.vatAmount).toBe(21.0);
    expect(result2024.totalWithVat).toBe(121.0);
  });

  test('should calculate VAT with correct rounding', async ({ db }) => {
    // Ensure STANDARD rate exists (should be seeded)
    const existingRate = await db.vatRate.findFirst({
      where: { code: 'STANDARD' },
    });

    if (!existingRate) {
      await db.vatRate.create({
        data: {
          code: 'STANDARD',
          name: 'Základní sazba',
          percentage: 21.0,
          validFrom: new Date('2024-01-01T00:00:00Z'),
          validTo: null,
        },
      });
    }

    // Test: 100 CZK + 21% = 121.00 CZK (exact)
    const result1 = await calculatePrice(100, 'STANDARD', new Date('2024-06-15'));
    expect(result1.vatAmount).toBe(21.0);
    expect(result1.totalWithVat).toBe(121.0);

    // Test: 100.50 CZK + 21% = 121.61 CZK (rounding: 21.105 → 21.11)
    const result2 = await calculatePrice(100.50, 'STANDARD', new Date('2024-06-15'));
    expect(result2.vatAmount).toBe(21.11);
    expect(result2.totalWithVat).toBe(121.61);

    // Test: 33.33 CZK + 21% = 40.33 CZK (rounding: 6.9993 → 7.00)
    const result3 = await calculatePrice(33.33, 'STANDARD', new Date('2024-06-15'));
    expect(result3.vatAmount).toBe(7.0);
    expect(result3.totalWithVat).toBe(40.33);
  });

  test('should handle invalid vatCode', async ({ db }) => {
    await expect(
      calculatePrice(100, 'INVALID_CODE', new Date('2024-06-15')),
    ).rejects.toThrow();
  });

  test('should handle date with no valid rate', async ({ db }) => {
    // Create a rate that's not valid for the test date
    await db.vatRate.create({
      data: {
        code: 'TEST_RATE',
        name: 'Test Rate',
        percentage: 10.0,
        validFrom: new Date('2025-01-01T00:00:00Z'),
        validTo: null,
      },
    });

    // Try to calculate with date before validFrom
    await expect(
      calculatePrice(100, 'TEST_RATE', new Date('2024-06-15')),
    ).rejects.toThrow();
  });

  test('should calculate total base cost correctly', () => {
    // Test: Single ingredient (quantity: 2, purchasePrice: 100) → 200.00
    const ingredients1 = [
      {
        itemDefinitionId: 1,
        quantity: 2,
        itemDefinition: {
          purchasePrice: new Prisma.Decimal(100),
        },
      },
    ];
    const cost1 = calculateTotalBaseCost(ingredients1);
    expect(cost1).toBe(200.0);

    // Test: Multiple ingredients (qty: 1, price: 50; qty: 3, price: 25) → 125.00
    const ingredients2 = [
      {
        itemDefinitionId: 1,
        quantity: 1,
        itemDefinition: {
          purchasePrice: new Prisma.Decimal(50),
        },
      },
      {
        itemDefinitionId: 2,
        quantity: 3,
        itemDefinition: {
          purchasePrice: new Prisma.Decimal(25),
        },
      },
    ];
    const cost2 = calculateTotalBaseCost(ingredients2);
    expect(cost2).toBe(125.0);

    // Test: Missing purchasePrice → treated as 0.00
    const ingredients3 = [
      {
        itemDefinitionId: 1,
        quantity: 2,
        itemDefinition: {
          purchasePrice: null,
        },
      },
    ];
    const cost3 = calculateTotalBaseCost(ingredients3);
    expect(cost3).toBe(0.0);

    // Test: Zero quantity → 0.00
    const ingredients4 = [
      {
        itemDefinitionId: 1,
        quantity: 0,
        itemDefinition: {
          purchasePrice: new Prisma.Decimal(100),
        },
      },
    ];
    const cost4 = calculateTotalBaseCost(ingredients4);
    expect(cost4).toBe(0.0);

    // Test: Decimal quantities and prices → proper rounding to 2 decimals
    const ingredients5 = [
      {
        itemDefinitionId: 1,
        quantity: 1.5,
        itemDefinition: {
          purchasePrice: new Prisma.Decimal(33.33),
        },
      },
    ];
    const cost5 = calculateTotalBaseCost(ingredients5);
    expect(cost5).toBe(50.0); // 1.5 * 33.33 = 49.995 → 50.00

    // Test: No ingredients → 0.00
    const cost6 = calculateTotalBaseCost([]);
    expect(cost6).toBe(0.0);
  });

  test('should handle number purchasePrice (not Decimal)', () => {
    // Test with number instead of Decimal
    const ingredients = [
      {
        itemDefinitionId: 1,
        quantity: 2,
        itemDefinition: {
          purchasePrice: 100,
        },
      },
    ];
    const cost = calculateTotalBaseCost(ingredients);
    expect(cost).toBe(200.0);
  });
});
