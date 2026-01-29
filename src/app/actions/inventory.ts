'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from "@/lib/prisma";
import { z } from 'zod';
import { InventoryStatus } from '@prisma/client';

// Validation schemas
const addInventoryItemSchema = z
  .object({
    itemDefinitionId: z.number().int().positive().optional(),
    note: z.string().optional(),
    name: z.string().optional(),
    width: z.number().positive('Šířka musí být kladné číslo'),
    height: z.number().positive('Výška musí být kladné číslo'),
    thickness: z.number().positive('Tloušťka musí být kladné číslo'),
    quantity: z
      .number()
      .int()
      .positive('Množství musí být kladné celé číslo')
      .default(1),
    totalPrice: z.number().nonnegative('Celková cena musí být nezáporné číslo'),
  })
  .refine(
    (data) => data.itemDefinitionId != null || (data.name != null && data.name.trim().length > 0),
    { message: 'Vyberte definici položky nebo zadejte název', path: ['name'] },
  );

const cutInventoryItemSchema = z.object({
  id: z.string().uuid('Neplatné ID'),
  cutWidth: z.number().positive('Šířka řezu musí být kladné číslo'),
  cutHeight: z.number().positive('Výška řezu musí být kladné číslo'),
  direction: z.enum(['horizontal', 'vertical'], {
    error: 'Směr musí být horizontal nebo vertical',
  }),
  saveMainRemnant: z.boolean(),
  saveSecondaryRemnant: z.boolean(),
});

const getAvailableSourceBoardsSchema = z.object({
  itemDefinitionId: z.number().int().positive(),
  minWidth: z.number().positive(),
  minHeight: z.number().positive(),
});

const performOrderCutSchema = z.object({
  sourceItemId: z.string().uuid('Neplatné ID zdrojové položky'),
  targetWidth: z.number().positive('Šířka musí být kladné číslo'),
  targetHeight: z.number().positive('Výška musí být kladné číslo'),
  quantity: z.number().int().positive('Množství musí být kladné').default(1),
  orderId: z.number().int().positive('ID objednávky musí být kladné'),
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

    let displayName: string;
    let itemDefinitionId: number | null = null;

    if (validated.itemDefinitionId != null) {
      const definition = await prisma.itemDefinition.findUnique({
        where: { id: validated.itemDefinitionId },
      });
      if (!definition) {
        return {
          success: false,
          error: 'Definice položky nenalezena',
        };
      }
      displayName =
        definition.name + (validated.note?.trim() ? ' – ' + validated.note.trim() : '');
      itemDefinitionId = definition.id;
    } else {
      displayName = validated.name!.trim();
    }

    const unitPrice = validated.totalPrice / validated.quantity;

    const items = await prisma.$transaction(
      Array.from({ length: validated.quantity }, () =>
        prisma.inventoryItem.create({
          data: {
            name: displayName,
            width: validated.width,
            height: validated.height,
            thickness: validated.thickness,
            price: unitPrice,
            status: InventoryStatus.AVAILABLE,
            itemDefinitionId,
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
        error: error.issues[0]?.message || 'Neplatná data',
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
            itemDefinitionId: originalItem.itemDefinitionId,
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
            itemDefinitionId: originalItem.itemDefinitionId,
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
        error: error.issues[0]?.message || 'Neplatná data',
      };
    }
    console.error('Error cutting inventory item:', error);
    return {
      success: false,
      error: 'Nepodařilo se provést řezání',
    };
  }
}

// Get available inventory items that match definition and are >= min dimensions (for order cut allocation)
export async function getAvailableSourceBoards(
  data: z.infer<typeof getAvailableSourceBoardsSchema>,
) {
  try {
    const validated = getAvailableSourceBoardsSchema.parse(data);

    const items = await prisma.inventoryItem.findMany({
      where: {
        itemDefinitionId: validated.itemDefinitionId,
        status: InventoryStatus.AVAILABLE,
        width: { gte: validated.minWidth },
        height: { gte: validated.minHeight },
      },
      orderBy: [{ width: 'asc' }, { height: 'asc' }],
      select: {
        id: true,
        name: true,
        width: true,
        height: true,
        thickness: true,
        price: true,
        itemDefinitionId: true,
      },
    });

    return { success: true, data: items };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Neplatná data',
      };
    }
    console.error('Error fetching source boards:', error);
    return {
      success: false,
      error: 'Nepodařilo se načíst dostupné desky',
    };
  }
}

// Minimum dimension (mm) for creating an offcut; smaller pieces are not stored
const MIN_OFFCUT_DIMENSION_MM = 10;

// Perform a cut for order allocation using Guillotine L-shape split:
// Consume source, create 1 target piece (reserved), create 1 or 2 offcuts (available).
// Offcut 1 (Right): (w_source - w_req) x h_source. Offcut 2 (Top): w_req x (h_source - h_req).
export async function performOrderCut(
  data: z.infer<typeof performOrderCutSchema>,
) {
  try {
    const validated = performOrderCutSchema.parse(data);

    const sourceItem = await prisma.inventoryItem.findUnique({
      where: { id: validated.sourceItemId },
    });

    if (!sourceItem) {
      return {
        success: false,
        error: 'Zdrojová položka nenalezena',
      };
    }

    if (sourceItem.status !== InventoryStatus.AVAILABLE) {
      return {
        success: false,
        error: 'Zdrojová položka není dostupná k řezání',
      };
    }

    const w_source = sourceItem.width;
    const h_source = sourceItem.height;
    const w_req = validated.targetWidth;
    const h_req = validated.targetHeight;

    if (w_source < w_req || h_source < h_req) {
      return {
        success: false,
        error: 'Rozměry zdrojové položky jsou menší než požadované',
      };
    }

    const originalArea = w_source * h_source;
    const targetArea = w_req * h_req;
    const targetPrice = (sourceItem.price * targetArea) / originalArea;

    // Guillotine L-shape: cut (w_req, h_req) from bottom-left of (w_source, h_source).
    // Offcut 1 (Right): strip to the right — width = w_source - w_req, height = h_source.
    // Offcut 2 (Top): strip above the cut — width = w_req, height = h_source - h_req.
    const offcutRight = {
      width: w_source - w_req,
      height: h_source,
      thickness: sourceItem.thickness,
    };
    const offcutTop = {
      width: w_req,
      height: h_source - h_req,
      thickness: sourceItem.thickness,
    };

    const isValidOffcut = (w: number, h: number) =>
      w > MIN_OFFCUT_DIMENSION_MM && h > MIN_OFFCUT_DIMENSION_MM;

    const createRight =
      isValidOffcut(offcutRight.width, offcutRight.height);
    const createTop =
      isValidOffcut(offcutTop.width, offcutTop.height);

    // Inheritance from source: all new items get these (critical for catalog/UI)
    const sourceId = validated.sourceItemId;
    const inheritedDefinitionId = sourceItem.itemDefinitionId;
    const inheritedThickness = sourceItem.thickness;

    const targetName = `${sourceItem.name} (Cut)`;
    const offcutName = generateRemnantName(sourceItem.name);

    await prisma.$transaction(async (tx) => {
      // 1. Consume source (one physical piece)
      await tx.inventoryItem.update({
        where: { id: sourceId },
        data: { status: InventoryStatus.CONSUMED },
      });

      // 2. Target item (piece matching required dims): reserved for the order
      await tx.inventoryItem.create({
        data: {
          name: targetName,
          width: w_req,
          height: h_req,
          thickness: inheritedThickness,
          price: targetPrice,
          status: InventoryStatus.AVAILABLE,
          reservedQuantity: 1, // Only the target is reserved; availability = 0
          parentId: sourceId,
          itemDefinitionId: inheritedDefinitionId,
        },
      });

      // 3. Offcuts (remainders): MUST be reservedQuantity: 0 and AVAILABLE so they are released to inventory
      if (createRight) {
        const area = offcutRight.width * offcutRight.height;
        const price = (sourceItem.price * area) / originalArea;
        await tx.inventoryItem.create({
          data: {
            name: offcutName,
            width: offcutRight.width,
            height: offcutRight.height,
            thickness: inheritedThickness,
            price,
            status: InventoryStatus.AVAILABLE,
            reservedQuantity: 0, // Offcuts are not reserved; fully available
            parentId: sourceId,
            itemDefinitionId: inheritedDefinitionId,
          },
        });
      }

      if (createTop) {
        const area = offcutTop.width * offcutTop.height;
        const price = (sourceItem.price * area) / originalArea;
        await tx.inventoryItem.create({
          data: {
            name: offcutName,
            width: offcutTop.width,
            height: offcutTop.height,
            thickness: inheritedThickness,
            price,
            status: InventoryStatus.AVAILABLE,
            reservedQuantity: 0, // Offcuts are not reserved; fully available
            parentId: sourceId,
            itemDefinitionId: inheritedDefinitionId,
          },
        });
      }
    });

    revalidatePath(`/orders/${validated.orderId}`);
    revalidatePath('/inventory');

    return {
      success: true,
      message: 'Řez proveden. Položka je rezervována pro zakázku.',
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Neplatná data',
      };
    }
    console.error('Error performing order cut:', error);
    return {
      success: false,
      error: 'Nepodařilo se provést řez',
    };
  }
}
