'use server';

import { prisma } from "@/lib/prisma";
import { z } from 'zod';
import { InventoryStatus } from '@prisma/client';

// Validation schemas
const addInventoryItemSchema = z.object({
  name: z.string().min(1, 'Název je povinný'),
  width: z.number().positive('Šířka musí být kladné číslo'),
  height: z.number().positive('Výška musí být kladné číslo'),
  thickness: z.number().positive('Tloušťka musí být kladné číslo'),
  quantity: z
    .number()
    .int()
    .positive('Množství musí být kladné celé číslo')
    .default(1),
  totalPrice: z.number().nonnegative('Celková cena musí být nezáporné číslo'),
});

const cutInventoryItemSchema = z.object({
  id: z.string().uuid('Neplatné ID'),
  cutWidth: z.number().positive('Šířka řezu musí být kladné číslo'),
  cutHeight: z.number().positive('Výška řezu musí být kladné číslo'),
  direction: z.enum(['horizontal', 'vertical'], {
    errorMap: () => ({ message: 'Směr musí být horizontal nebo vertical' }),
  }),
  saveMainRemnant: z.boolean(),
  saveSecondaryRemnant: z.boolean(),
});

// Helper function to generate remnant name
function generateRemnantName(originalName: string): string {
  // Avoid recursive names like "Zbytek z Zbytek z..."
  if (originalName.startsWith('Zbytek z ')) {
    return `Zbytek z ${originalName}`;
  }
  return `Zbytek z ${originalName}`;
}

// Get all inventory items
export async function getInventoryItems() {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        parent: {
          select: {
            name: true,
          },
        },
      },
    });

    return { success: true, data: items };
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    return {
      success: false,
      error: 'Nepodařilo se načíst položky skladu',
    };
  }
}

// Add inventory item(s) with bulk support
export async function addInventoryItem(
  data: z.infer<typeof addInventoryItemSchema>,
) {
  try {
    const validated = addInventoryItemSchema.parse(data);

    // Calculate unit price
    const unitPrice = validated.totalPrice / validated.quantity;

    // Create items in bulk using transaction
    const items = await prisma.$transaction(
      Array.from({ length: validated.quantity }, () =>
        prisma.inventoryItem.create({
          data: {
            name: validated.name,
            width: validated.width,
            height: validated.height,
            thickness: validated.thickness,
            price: unitPrice,
            status: InventoryStatus.AVAILABLE,
          },
        }),
      ),
    );

    return {
      success: true,
      data: items,
      message: `Přidáno ${validated.quantity} položek`,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0]?.message || 'Neplatná data',
      };
    }
    console.error('Error adding inventory item:', error);
    return {
      success: false,
      error: 'Nepodařilo se přidat položku skladu',
    };
  }
}

// Cut inventory item with smart cut logic
export async function cutInventoryItem(
  data: z.infer<typeof cutInventoryItemSchema>,
) {
  try {
    const validated = cutInventoryItemSchema.parse(data);

    // Get the original item
    const originalItem = await prisma.inventoryItem.findUnique({
      where: { id: validated.id },
    });

    if (!originalItem) {
      return {
        success: false,
        error: 'Položka nenalezena',
      };
    }

    if (originalItem.status !== InventoryStatus.AVAILABLE) {
      return {
        success: false,
        error: 'Položka není dostupná k řezání',
      };
    }

    // Check if dimensions match (Consume Whole)
    const matchesWhole =
      validated.cutWidth === originalItem.width &&
      validated.cutHeight === originalItem.height;

    if (matchesWhole) {
      // Just consume the item
      await prisma.inventoryItem.update({
        where: { id: validated.id },
        data: {
          status: InventoryStatus.CONSUMED,
        },
      });

      return {
        success: true,
        message: 'Položka byla spotřebována',
      };
    }

    // Smart Cut logic
    let mainRemnant: {
      width: number;
      height: number;
      thickness: number;
    } | null = null;
    let secondaryRemnant: {
      width: number;
      height: number;
      thickness: number;
    } | null = null;

    if (validated.direction === 'horizontal') {
      // Horizontal cut: cut along width
      if (validated.cutWidth > originalItem.width) {
        return {
          success: false,
          error: 'Šířka řezu nesmí být větší než šířka původní položky',
        };
      }

      // Main remnant: remaining width, full height
      mainRemnant = {
        width: originalItem.width - validated.cutWidth,
        height: originalItem.height,
        thickness: originalItem.thickness,
      };

      // Secondary remnant: cut width, remaining height (if any)
      if (validated.cutHeight < originalItem.height) {
        secondaryRemnant = {
          width: validated.cutWidth,
          height: originalItem.height - validated.cutHeight,
          thickness: originalItem.thickness,
        };
      }
    } else {
      // Vertical cut: cut along height
      if (validated.cutHeight > originalItem.height) {
        return {
          success: false,
          error: 'Výška řezu nesmí být větší než výška původní položky',
        };
      }

      // Main remnant: full width, remaining height
      mainRemnant = {
        width: originalItem.width,
        height: originalItem.height - validated.cutHeight,
        thickness: originalItem.thickness,
      };

      // Secondary remnant: remaining width, cut height (if any)
      if (validated.cutWidth < originalItem.width) {
        secondaryRemnant = {
          width: originalItem.width - validated.cutWidth,
          height: validated.cutHeight,
          thickness: originalItem.thickness,
        };
      }
    }

    // Calculate prices proportionally based on area
    const originalArea = originalItem.width * originalItem.height;
    const cutArea = validated.cutWidth * validated.cutHeight;
    const cutPrice = (originalItem.price * cutArea) / originalArea;

    // Execute transaction
    await prisma.$transaction(async (tx) => {
      // Mark original as consumed
      await tx.inventoryItem.update({
        where: { id: validated.id },
        data: {
          status: InventoryStatus.CONSUMED,
        },
      });

      const remnantName = generateRemnantName(originalItem.name);

      // Create main remnant if requested and valid
      if (validated.saveMainRemnant && mainRemnant) {
        const mainRemnantArea = mainRemnant.width * mainRemnant.height;
        const mainRemnantPrice =
          (originalItem.price * mainRemnantArea) / originalArea;

        await tx.inventoryItem.create({
          data: {
            name: remnantName,
            width: mainRemnant.width,
            height: mainRemnant.height,
            thickness: mainRemnant.thickness,
            price: mainRemnantPrice,
            status: InventoryStatus.REMNANT,
            parentId: validated.id,
          },
        });
      }

      // Create secondary remnant if requested and valid
      if (validated.saveSecondaryRemnant && secondaryRemnant) {
        const secondaryRemnantArea =
          secondaryRemnant.width * secondaryRemnant.height;
        const secondaryRemnantPrice =
          (originalItem.price * secondaryRemnantArea) / originalArea;

        await tx.inventoryItem.create({
          data: {
            name: remnantName,
            width: secondaryRemnant.width,
            height: secondaryRemnant.height,
            thickness: secondaryRemnant.thickness,
            price: secondaryRemnantPrice,
            status: InventoryStatus.REMNANT,
            parentId: validated.id,
          },
        });
      }
    });

    return {
      success: true,
      message: 'Řezání dokončeno',
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0]?.message || 'Neplatná data',
      };
    }
    console.error('Error cutting inventory item:', error);
    return {
      success: false,
      error: 'Nepodařilo se provést řezání',
    };
  }
}
