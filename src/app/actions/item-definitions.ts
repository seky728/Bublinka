'use server';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import {
  createItemDefinitionSchema,
  updateItemDefinitionSchema,
  deleteItemDefinitionSchema,
  type CreateItemDefinitionInput,
  type UpdateItemDefinitionInput,
  type DeleteItemDefinitionInput,
} from '@/lib/schemas/item-definitions';

function parseProperties(
  raw: unknown
): Record<string, string | number | boolean> | undefined | null {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : undefined;
    } catch {
      return undefined;
    }
  }
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, string | number | boolean>;
  }
  return undefined;
}

export async function getAllItemDefinitions() {
  try {
    const definitions = await prisma.itemDefinition.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return { success: true as const, data: definitions };
  } catch (error) {
    console.error('Error fetching item definitions:', error);
    return {
      success: false as const,
      error: 'Nepodařilo se načíst definice položek',
    };
  }
}

export async function createItemDefinition(
  data: CreateItemDefinitionInput & { properties?: unknown }
) {
  try {
    const properties = parseProperties(data.properties);
    const validated = createItemDefinitionSchema.parse({
      ...data,
      properties: properties ?? undefined,
    });

    const definition = await prisma.itemDefinition.create({
      data: {
        name: validated.name,
        category: validated.category,
        description: validated.description ?? null,
        properties: validated.properties ?? undefined,
      },
    });

    return {
      success: true as const,
      data: definition,
      message: 'Definice byla úspěšně vytvořena',
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        error: error.issues[0]?.message || 'Neplatná data',
      };
    }
    console.error('Error creating item definition:', error);
    return {
      success: false as const,
      error: 'Nepodařilo se vytvořit definici',
    };
  }
}

export async function updateItemDefinition(
  data: UpdateItemDefinitionInput & { properties?: unknown }
) {
  try {
    const properties = parseProperties(data.properties);
    const validated = updateItemDefinitionSchema.parse({
      ...data,
      properties: properties ?? undefined,
    });

    const existing = await prisma.itemDefinition.findUnique({
      where: { id: validated.id },
    });

    if (!existing) {
      return {
        success: false as const,
        error: 'Definice nenalezena',
      };
    }

    const updateData: {
      name?: string;
      category?: 'SHEET_MATERIAL' | 'COMPONENT' | 'OTHER';
      description?: string | null;
      properties?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
    } = {};

    if (validated.name !== undefined) {
      updateData.name = validated.name;
    }
    if (validated.category !== undefined) {
      updateData.category = validated.category;
    }
    if (validated.description !== undefined) {
      updateData.description = validated.description;
    }
    if (validated.properties !== undefined) {
      updateData.properties =
        validated.properties === null ? Prisma.JsonNull : validated.properties;
    }

    const definition = await prisma.itemDefinition.update({
      where: { id: validated.id },
      data: updateData,
    });

    return {
      success: true as const,
      data: definition,
      message: 'Definice byla úspěšně aktualizována',
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        error: error.issues[0]?.message || 'Neplatná data',
      };
    }
    console.error('Error updating item definition:', error);
    return {
      success: false as const,
      error: 'Nepodařilo se aktualizovat definici',
    };
  }
}

export async function deleteItemDefinition(data: DeleteItemDefinitionInput) {
  try {
    const validated = deleteItemDefinitionSchema.parse(data);

    const existing = await prisma.itemDefinition.findUnique({
      where: { id: validated.id },
    });

    if (!existing) {
      return {
        success: false as const,
        error: 'Definice nenalezena',
      };
    }

    await prisma.itemDefinition.delete({
      where: { id: validated.id },
    });

    return {
      success: true as const,
      message: 'Definice byla úspěšně smazána',
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        error: error.issues[0]?.message || 'Neplatná data',
      };
    }
    console.error('Error deleting item definition:', error);
    return {
      success: false as const,
      error: 'Nepodařilo se smazat definici',
    };
  }
}
