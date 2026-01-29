import { z } from 'zod';

// OrderStatus enum for validation
const orderStatusEnum = z.enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], {
  errorMap: () => ({ message: 'Neplatný status objednávky' }),
});

// Validation schemas
export const createOrderSchema = z.object({
  name: z.string().min(1, 'Název je povinný'),
  status: orderStatusEnum.optional().default('DRAFT'),
});

export const updateOrderSchema = z.object({
  id: z.number().int().positive('ID musí být kladné celé číslo'),
  name: z.string().min(1, 'Název je povinný').optional(),
  status: orderStatusEnum.optional(),
});

export const deleteOrderSchema = z.object({
  id: z.number().int().positive('ID musí být kladné celé číslo'),
});

export const addOrderItemSchema = z.object({
  orderId: z.number().int().positive('ID objednávky musí být kladné celé číslo'),
  productId: z.string().uuid('Neplatné ID produktu'),
  quantity: z.number().int().positive('Množství musí být kladné celé číslo'),
});

export const removeOrderItemSchema = z.object({
  itemId: z.number().int().positive('ID položky musí být kladné celé číslo'),
});

export const getOrderSchema = z.object({
  id: z.number().int().positive('ID musí být kladné celé číslo'),
});

export const updateOrderStatusSchema = z.object({
  id: z.number().int().positive('ID musí být kladné celé číslo'),
  status: orderStatusEnum,
});

// Type exports
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type DeleteOrderInput = z.infer<typeof deleteOrderSchema>;
export type AddOrderItemInput = z.infer<typeof addOrderItemSchema>;
export type RemoveOrderItemInput = z.infer<typeof removeOrderItemSchema>;
export type GetOrderInput = z.infer<typeof getOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
