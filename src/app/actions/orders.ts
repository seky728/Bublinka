'use server';

import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import {
  createOrderSchema,
  updateOrderSchema,
  deleteOrderSchema,
  addOrderItemSchema,
  removeOrderItemSchema,
  getOrderSchema,
  updateOrderStatusSchema,
  type CreateOrderInput,
  type UpdateOrderInput,
  type DeleteOrderInput,
  type AddOrderItemInput,
  type RemoveOrderItemInput,
  type GetOrderInput,
  type UpdateOrderStatusInput,
} from '@/lib/schemas/orders';
import type { MaterialRequirement } from '@/lib/types/order-material';

// Helper function to format order ID as #0000
function formatOrderId(id: number): string {
  return `#${id.toString().padStart(4, '0')}`;
}

// Get all orders with item counts
export async function getOrders() {
  try {
    const orders = await prisma.order.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        items: {
          select: {
            id: true,
          },
        },
      },
    });

    const ordersWithCounts = orders.map((order) => ({
      id: order.id,
      formattedId: formatOrderId(order.id),
      name: order.name,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      itemCount: order.items.length,
    }));

    return { success: true, data: ordersWithCounts };
  } catch (error) {
    console.error('Error fetching orders:', error);
    return {
      success: false,
      error: 'Nepodařilo se načíst objednávky',
    };
  }
}

// Get single order with all items and product details
export async function getOrder(data: GetOrderInput) {
  try {
    const validated = getOrderSchema.parse(data);

    const order = await prisma.order.findUnique({
      where: { id: validated.id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sellingPrice: true,
                photoUrl: true,
              },
            },
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
    });

    if (!order) {
      return {
        success: false,
        error: 'Objednávka nenalezena',
      };
    }

    return {
      success: true,
      data: {
        ...order,
        formattedId: formatOrderId(order.id),
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Neplatná data',
      };
    }
    console.error('Error fetching order:', error);
    return {
      success: false,
      error: 'Nepodařilo se načíst objednávku',
    };
  }
}

// Get material availability for an order (requirements + status: ready / cut_needed / missing)
export async function getOrderMaterialAvailability(data: GetOrderInput) {
  try {
    const validated = getOrderSchema.parse(data);

    const order = await prisma.order.findUnique({
      where: { id: validated.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                ingredients: {
                  include: {
                    itemDefinition: {
                      select: { id: true, name: true, category: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return {
        success: false,
        error: 'Objednávka nenalezena',
      };
    }

    // Aggregate requirements: key = (itemDefinitionId, width?, height?) -> { quantityRequired, definitionName, category }
    type AggKey = { itemDefinitionId: number; width?: number; height?: number };
    const aggMap = new Map<string, { key: AggKey; quantityRequired: number; definitionName: string; category: 'SHEET_MATERIAL' | 'COMPONENT' | 'OTHER' }>();

    for (const orderItem of order.items) {
      for (const ing of orderItem.product.ingredients) {
        if (ing.itemDefinitionId == null || !ing.itemDefinition) continue;

        const def = ing.itemDefinition;
        const category = def.category as 'SHEET_MATERIAL' | 'COMPONENT' | 'OTHER';
        const qty = orderItem.quantity * ing.quantity;

        const width = ing.width ?? undefined;
        const height = ing.height ?? undefined;
        const key: AggKey = { itemDefinitionId: ing.itemDefinitionId, width, height };
        const keyStr = `${key.itemDefinitionId}_${width ?? ''}_${height ?? ''}`;

        const existing = aggMap.get(keyStr);
        if (existing) {
          existing.quantityRequired += qty;
        } else {
          aggMap.set(keyStr, {
            key,
            quantityRequired: qty,
            definitionName: def.name,
            category,
          });
        }
      }
    }

    const requirements: MaterialRequirement[] = [];

    for (const entry of aggMap.values()) {
      const { key, quantityRequired, definitionName, category } = entry;
      const req: MaterialRequirement = {
        itemDefinitionId: key.itemDefinitionId,
        definitionName,
        category,
        quantityRequired,
        width: key.width,
        height: key.height,
        status: 'missing',
      };

      const inventoryItems = await prisma.inventoryItem.findMany({
        where: {
          itemDefinitionId: key.itemDefinitionId,
          status: 'AVAILABLE',
        },
        select: { id: true, width: true, height: true },
      });

      if (category === 'SHEET_MATERIAL' && key.width != null && key.height != null) {
        const reqW = key.width;
        const reqH = key.height;
        const exact = inventoryItems.filter((i) => i.width === reqW && i.height === reqH);
        const larger = inventoryItems.filter((i) => i.width >= reqW && i.height >= reqH && (i.width !== reqW || i.height !== reqH));
        req.exactCount = exact.length;
        req.largerCount = larger.length;
        if (exact.length >= quantityRequired) {
          req.status = 'ready';
        } else if (exact.length + larger.length > 0) {
          req.status = 'cut_needed';
        }
      } else {
        const count = inventoryItems.length;
        req.status = count >= quantityRequired ? 'ready' : 'missing';
      }

      requirements.push(req);
    }

    return { success: true, data: requirements };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Neplatná data',
      };
    }
    console.error('Error fetching order material availability:', error);
    return {
      success: false,
      error: 'Nepodařilo se načíst dostupnost materiálu',
    };
  }
}

// Create order
export async function createOrder(data: CreateOrderInput) {
  try {
    const validated = createOrderSchema.parse(data);

    const order = await prisma.order.create({
      data: {
        name: validated.name,
        status: validated.status || 'DRAFT',
      },
      include: {
        items: true,
      },
    });

    return {
      success: true,
      data: {
        ...order,
        formattedId: formatOrderId(order.id),
      },
      message: 'Objednávka byla úspěšně vytvořena',
      orderId: order.id, // Return ID for redirect
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Neplatná data',
      };
    }
    console.error('Error creating order:', error);
    return {
      success: false,
      error: 'Nepodařilo se vytvořit objednávku',
    };
  }
}

// Update order
export async function updateOrder(data: UpdateOrderInput) {
  try {
    const validated = updateOrderSchema.parse(data);

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id: validated.id },
    });

    if (!existingOrder) {
      return {
        success: false,
        error: 'Objednávka nenalezena',
      };
    }

    // Build update data (only include fields that are provided)
    const updateData: {
      name?: string;
      status?: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    } = {};

    if (validated.name !== undefined) {
      updateData.name = validated.name;
    }

    if (validated.status !== undefined) {
      updateData.status = validated.status;
    }

    const order = await prisma.order.update({
      where: { id: validated.id },
      data: updateData,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sellingPrice: true,
                photoUrl: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      data: {
        ...order,
        formattedId: formatOrderId(order.id),
      },
      message: 'Objednávka byla úspěšně aktualizována',
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Neplatná data',
      };
    }
    console.error('Error updating order:', error);
    return {
      success: false,
      error: 'Nepodařilo se aktualizovat objednávku',
    };
  }
}

// Delete order
export async function deleteOrder(data: DeleteOrderInput) {
  try {
    const validated = deleteOrderSchema.parse(data);

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id: validated.id },
    });

    if (!existingOrder) {
      return {
        success: false,
        error: 'Objednávka nenalezena',
      };
    }

    // Delete order (cascade will delete OrderItems automatically)
    await prisma.order.delete({
      where: { id: validated.id },
    });

    return {
      success: true,
      message: 'Objednávka byla úspěšně smazána',
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Neplatná data',
      };
    }
    console.error('Error deleting order:', error);
    return {
      success: false,
      error: 'Nepodařilo se smazat objednávku',
    };
  }
}

// Add product to order
export async function addOrderItem(data: AddOrderItemInput) {
  try {
    const validated = addOrderItemSchema.parse(data);

    // Check if order exists
    const order = await prisma.order.findUnique({
      where: { id: validated.orderId },
    });

    if (!order) {
      return {
        success: false,
        error: 'Objednávka nenalezena',
      };
    }

    // Check if product exists and get current price
    const product = await prisma.product.findUnique({
      where: { id: validated.productId },
      select: {
        id: true,
        name: true,
        sellingPrice: true,
      },
    });

    if (!product) {
      return {
        success: false,
        error: 'Produkt nenalezen',
      };
    }

    // Check if product already exists in order (prevent duplicates)
    const existingItem = await prisma.orderItem.findUnique({
      where: {
        orderId_productId: {
          orderId: validated.orderId,
          productId: validated.productId,
        },
      },
    });

    if (existingItem) {
      return {
        success: false,
        error: 'Produkt již je v objednávce',
      };
    }

    // Create order item with price snapshot
    const orderItem = await prisma.orderItem.create({
      data: {
        orderId: validated.orderId,
        productId: validated.productId,
        quantity: validated.quantity,
        unitPrice: product.sellingPrice, // Snapshot of price at order creation
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sellingPrice: true,
            photoUrl: true,
          },
        },
      },
    });

    return {
      success: true,
      data: orderItem,
      message: 'Produkt byl úspěšně přidán do objednávky',
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Neplatná data',
      };
    }
    console.error('Error adding order item:', error);
    return {
      success: false,
      error: 'Nepodařilo se přidat produkt do objednávky',
    };
  }
}

// Update order status with transition validation
export async function updateOrderStatus(data: UpdateOrderStatusInput) {
  try {
    const validated = updateOrderStatusSchema.parse(data);

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id: validated.id },
      select: { status: true },
    });

    if (!existingOrder) {
      return {
        success: false,
        error: 'Objednávka nenalezena',
      };
    }

    const currentStatus = existingOrder.status;
    const newStatus = validated.status;

    // Validate status transitions
    const allowedTransitions: Record<string, string[]> = {
      DRAFT: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'DRAFT', 'CANCELLED'],
      COMPLETED: ['CANCELLED', 'IN_PROGRESS'], // Allow reopening completed orders
      CANCELLED: ['DRAFT'], // Allow restoring cancelled orders
    };

    // Allow transition to CANCELLED from any status
    if (newStatus === 'CANCELLED') {
      // This is always allowed
    } else if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
      return {
        success: false,
        error: `Nelze změnit status z ${currentStatus} na ${newStatus}`,
      };
    }

    // Get order with items and product ingredients (itemDefinition + legacy inventoryItem)
    const orderWithItems = await prisma.order.findUnique({
      where: { id: validated.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                ingredients: {
                  include: {
                    itemDefinition: { select: { id: true } },
                    inventoryItem: { select: { id: true, name: true, itemDefinitionId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!orderWithItems) {
      return {
        success: false,
        error: 'Objednávka nenalezena',
      };
    }

    // Build requirements: by itemDefinitionId (preferred) or by name (legacy)
    type RequirementKey = { type: 'definition'; id: number } | { type: 'name'; name: string };
    const requirementMap = new Map<string, number>();

    for (const orderItem of orderWithItems.items) {
      for (const ingredient of orderItem.product.ingredients) {
        const neededQty = ingredient.quantity * orderItem.quantity;
        let key: RequirementKey;
        if (ingredient.itemDefinitionId != null) {
          key = { type: 'definition', id: ingredient.itemDefinitionId };
        } else if (ingredient.inventoryItemId != null && ingredient.inventoryItem) {
          const inv = ingredient.inventoryItem;
          if (inv.itemDefinitionId != null) {
            key = { type: 'definition', id: inv.itemDefinitionId };
          } else {
            key = { type: 'name', name: inv.name };
          }
        } else {
          continue;
        }
        const s = JSON.stringify(key);
        requirementMap.set(s, (requirementMap.get(s) ?? 0) + neededQty);
      }
    }

    const getWhereForKey = (key: RequirementKey) => {
      if (key.type === 'definition') {
        return { itemDefinitionId: key.id, status: 'AVAILABLE' as const, reservedQuantity: 0 };
      }
      return { name: key.name, status: 'AVAILABLE' as const, reservedQuantity: 0 };
    };
    const getWhereReservedForKey = (key: RequirementKey) => {
      if (key.type === 'definition') {
        return { itemDefinitionId: key.id, reservedQuantity: { gt: 0 } };
      }
      return { name: key.name, reservedQuantity: { gt: 0 } };
    };

    const entries: { key: RequirementKey; requiredQty: number }[] = Array.from(requirementMap.entries()).map(([s, requiredQty]) => ({
      key: JSON.parse(s) as RequirementKey,
      requiredQty,
    }));

    // Handle inventory reservations based on status transitions
    await prisma.$transaction(async (tx) => {

      if (currentStatus === 'DRAFT' && newStatus === 'IN_PROGRESS') {
        for (const { key, requiredQty } of entries) {
          const availableItems = await tx.inventoryItem.findMany({
            where: getWhereForKey(key),
            orderBy: { createdAt: 'asc' },
            take: Math.ceil(requiredQty),
          });
          let remainingQty = requiredQty;
          for (const item of availableItems) {
            if (remainingQty <= 0) break;
            const reserveAmount = Math.min(1, remainingQty);
            await tx.inventoryItem.update({
              where: { id: item.id },
              data: { reservedQuantity: reserveAmount },
            });
            remainingQty -= reserveAmount;
          }
          if (remainingQty > 0) {
            const label = key.type === 'definition' ? `definition ${key.id}` : key.name;
            console.warn(`Warning: Not enough available inventory for ${label}. Required: ${requiredQty}, Available: ${availableItems.length}`);
          }
        }
      } else if (currentStatus === 'IN_PROGRESS' && newStatus === 'COMPLETED') {
        for (const { key, requiredQty } of entries) {
          const reservedItems = await tx.inventoryItem.findMany({
            where: getWhereReservedForKey(key),
            orderBy: { createdAt: 'asc' },
            take: Math.ceil(requiredQty),
          });
          let remainingQty = requiredQty;
          for (const item of reservedItems) {
            if (remainingQty <= 0) break;
            const consumeAmount = Math.min(item.reservedQuantity, remainingQty);
            await tx.inventoryItem.update({
              where: { id: item.id },
              data: { reservedQuantity: 0, status: 'CONSUMED' },
            });
            remainingQty -= consumeAmount;
          }
        }
      } else if (currentStatus === 'IN_PROGRESS' && (newStatus === 'DRAFT' || newStatus === 'CANCELLED')) {
        for (const { key, requiredQty } of entries) {
          const reservedItems = await tx.inventoryItem.findMany({
            where: getWhereReservedForKey(key),
            orderBy: { createdAt: 'asc' },
            take: Math.ceil(requiredQty),
          });
          let remainingQty = requiredQty;
          for (const item of reservedItems) {
            if (remainingQty <= 0) break;
            const releaseAmount = Math.min(item.reservedQuantity, remainingQty);
            await tx.inventoryItem.update({
              where: { id: item.id },
              data: { reservedQuantity: Math.max(0, item.reservedQuantity - releaseAmount) },
            });
            remainingQty -= releaseAmount;
          }
        }
      } else if (currentStatus === 'COMPLETED' && newStatus === 'IN_PROGRESS') {
        for (const { key, requiredQty } of entries) {
          const availableItems = await tx.inventoryItem.findMany({
            where: getWhereForKey(key),
            orderBy: { createdAt: 'asc' },
            take: Math.ceil(requiredQty),
          });
          let remainingQty = requiredQty;
          for (const item of availableItems) {
            if (remainingQty <= 0) break;
            const reserveAmount = Math.min(1, remainingQty);
            await tx.inventoryItem.update({
              where: { id: item.id },
              data: { reservedQuantity: reserveAmount },
            });
            remainingQty -= reserveAmount;
          }
        }
      } else if (currentStatus === 'CANCELLED' && newStatus === 'DRAFT') {
        // No inventory change
      }

      // Update order status
      await tx.order.update({
        where: { id: validated.id },
        data: { status: newStatus },
      });
    });

    // Fetch updated order for response
    const order = await prisma.order.findUnique({
      where: { id: validated.id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sellingPrice: true,
                photoUrl: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return {
        success: false,
        error: 'Objednávka nenalezena',
      };
    }

    const statusMessages: Record<string, string> = {
      IN_PROGRESS: 'Objednávka byla zahájena',
      COMPLETED: 'Objednávka byla dokončena',
      DRAFT: 'Objednávka byla vrácena do návrhu',
      CANCELLED: 'Objednávka byla zrušena',
    };

    // Special messages for specific transitions
    if (currentStatus === 'CANCELLED' && newStatus === 'DRAFT') {
      statusMessages.DRAFT = 'Zakázka byla obnovena do návrhu';
    }
    if (currentStatus === 'COMPLETED' && newStatus === 'IN_PROGRESS') {
      statusMessages.IN_PROGRESS = 'Zakázka byla znovu otevřena';
    }

    return {
      success: true,
      data: {
        ...order,
        formattedId: formatOrderId(order.id),
      },
      message: statusMessages[newStatus] || 'Status objednávky byl aktualizován',
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Neplatná data',
      };
    }
    console.error('Error updating order status:', error);
    return {
      success: false,
      error: 'Nepodařilo se aktualizovat status objednávky',
    };
  }
}

// Remove product from order
export async function removeOrderItem(data: RemoveOrderItemInput) {
  try {
    const validated = removeOrderItemSchema.parse(data);

    // Check if order item exists
    const existingItem = await prisma.orderItem.findUnique({
      where: { id: validated.itemId },
    });

    if (!existingItem) {
      return {
        success: false,
        error: 'Položka objednávky nenalezena',
      };
    }

    // Delete order item
    await prisma.orderItem.delete({
      where: { id: validated.itemId },
    });

    return {
      success: true,
      message: 'Produkt byl úspěšně odebrán z objednávky',
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Neplatná data',
      };
    }
    console.error('Error removing order item:', error);
    return {
      success: false,
      error: 'Nepodařilo se odebrat produkt z objednávky',
    };
  }
}
