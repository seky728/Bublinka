'use server';

import { prisma } from '@/lib/prisma';

export interface CalculatePriceResult {
  rateUsed: number;
  vatAmount: number;
  totalWithVat: number;
}

/**
 * Calculate VAT and total price with VAT based on VAT code and reference date
 * @param amountWithoutVat - Amount without VAT
 * @param vatCode - Semantic VAT code (e.g., "STANDARD", "REDUCED", "ZERO")
 * @param referenceDate - Reference date for rate lookup (default: current date)
 * @returns Object with rateUsed, vatAmount, and totalWithVat
 */
export async function calculatePrice(
  amountWithoutVat: number,
  vatCode: string,
  referenceDate: Date = new Date(),
): Promise<CalculatePriceResult> {
  // Find valid VAT rate for the given code and date
  const vatRate = await prisma.vatRate.findFirst({
    where: {
      code: vatCode,
      validFrom: {
        lte: referenceDate,
      },
      OR: [
        { validTo: null },
        { validTo: { gte: referenceDate } },
      ],
    },
    orderBy: {
      validFrom: 'desc',
    },
  });

  if (!vatRate) {
    throw new Error(
      `No valid VAT rate found for code "${vatCode}" on date ${referenceDate.toISOString()}`,
    );
  }

  // Convert Decimal to number if needed
  const percentage = typeof vatRate.percentage === 'object' && 'toNumber' in vatRate.percentage
    ? vatRate.percentage.toNumber()
    : Number(vatRate.percentage);

  // Calculate VAT amount
  const vatAmount = amountWithoutVat * (percentage / 100);

  // Round VAT amount mathematically to 2 decimal places (Czech standard)
  const roundedVatAmount = Math.round(vatAmount * 100) / 100;

  // Calculate total with VAT
  const totalWithVat = amountWithoutVat + roundedVatAmount;

  return {
    rateUsed: percentage,
    vatAmount: roundedVatAmount,
    totalWithVat: totalWithVat,
  };
}

