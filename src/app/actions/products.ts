'use server';

import { prisma } from '@/lib/prisma';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';
import {
  createProductSchema,
  updateProductSchema,
  deleteProductSchema,
  getProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from '@/lib/schemas/products';

// Get all products with their ingredients
export async function getProducts() {
  try {
    const products = await prisma.product.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        ingredients: {
          include: {
            itemDefinition: {
              select: {
                id: true,
                name: true,
                category: true,
              },
            },
            inventoryItem: {
              select: {
                id: true,
                name: true,
                width: true,
                height: true,
                thickness: true,
                price: true,
                status: true,
              },
            },
          },
        },
      },
    });

    // Generate signed URLs for product images (photoUrl is now a path, not a full URL)
    const productsWithSignedUrls = await Promise.all(
      products.map(async (product) => {
        if (product.photoUrl) {
          try {
            // Generate signed URL valid for 1 hour (3600 seconds)
            const { data, error } = await supabase.storage
              .from('products')
              .createSignedUrl(product.photoUrl, 3600);

            if (error) {
              console.error('Error generating signed URL for product:', product.id, error);
              // Return product without photoUrl if signing fails
              return { ...product, photoUrl: null };
            }

            // Replace path with signed URL
            return { ...product, photoUrl: data.signedUrl };
          } catch (error) {
            console.error('Error generating signed URL for product:', product.id, error);
            // Return product without photoUrl if signing fails
            return { ...product, photoUrl: null };
          }
        }
        return product;
      }),
    );

    return { success: true, data: productsWithSignedUrls };
  } catch (error) {
    console.error('Error fetching products:', error);
    return {
      success: false,
      error: 'Nepodařilo se načíst produkty',
    };
  }
}

// Create product with ingredients
export async function createProduct(data: CreateProductInput) {
  try {
    const validated = createProductSchema.parse(data);

    // Create product and ingredients in a transaction
    const product = await prisma.$transaction(async (tx) => {
      // Create product
      const newProduct = await tx.product.create({
        data: {
          name: validated.name,
          description: validated.description || null,
          sellingPrice: validated.sellingPrice,
          productionSteps: validated.productionSteps || null,
          photoUrl: validated.photoUrl || null,
        },
      });

      // Create ingredients (definition-based; inventoryItemId left null)
      await tx.productIngredient.createMany({
        data: validated.ingredients.map((ingredient) => ({
          productId: newProduct.id,
          itemDefinitionId: ingredient.itemDefinitionId,
          inventoryItemId: null,
          quantity: ingredient.quantity,
          width: ingredient.width ?? null,
          height: ingredient.height ?? null,
        })),
      });

      // Return product with ingredients (itemDefinition + legacy inventoryItem)
      return await tx.product.findUnique({
        where: { id: newProduct.id },
        include: {
          ingredients: {
            include: {
              itemDefinition: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                },
              },
              inventoryItem: {
                select: {
                  id: true,
                  name: true,
                  width: true,
                  height: true,
                  thickness: true,
                  price: true,
                  status: true,
                },
              },
            },
          },
        },
      });
    });

    return {
      success: true,
      data: product,
      message: 'Produkt byl úspěšně vytvořen',
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Neplatná data',
      };
    }
    console.error('Error creating product:', error);
    return {
      success: false,
      error: 'Nepodařilo se vytvořit produkt',
    };
  }
}

// Get single product with ingredients (for editing)
export async function getProduct(id: string) {
  try {
    const validated = getProductSchema.parse({ id });

    const product = await prisma.product.findUnique({
      where: { id: validated.id },
      include: {
        ingredients: {
          include: {
            itemDefinition: {
              select: {
                id: true,
                name: true,
                category: true,
              },
            },
            inventoryItem: {
              select: {
                id: true,
                name: true,
                width: true,
                height: true,
                thickness: true,
                price: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      return {
        success: false,
        error: 'Produkt nenalezen',
      };
    }

    // Add signed URL for display; keep photoUrl as path for form submit
    if (product.photoUrl) {
      try {
        const { data, error } = await supabase.storage
          .from('products')
          .createSignedUrl(product.photoUrl, 3600);

        if (!error && data?.signedUrl) {
          return {
            success: true,
            data: { ...product, imageUrl: data.signedUrl } as typeof product & {
              imageUrl: string;
            },
          };
        }
      } catch (e) {
        console.error('Error generating signed URL for product:', product.id, e);
      }
    }

    return {
      success: true,
      data: { ...product, imageUrl: null } as typeof product & { imageUrl: string | null },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Neplatná data',
      };
    }
    console.error('Error fetching product:', error);
    return {
      success: false,
      error: 'Nepodařilo se načíst produkt',
    };
  }
}

// Update product and replace ingredients
export async function updateProduct(data: UpdateProductInput) {
  try {
    const validated = updateProductSchema.parse(data);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: validated.id },
        data: {
          name: validated.name,
          description: validated.description ?? null,
          sellingPrice: validated.sellingPrice,
          productionSteps: validated.productionSteps ?? null,
          photoUrl: validated.photoUrl ?? undefined,
        },
      });

      await tx.productIngredient.deleteMany({
        where: { productId: validated.id },
      });

      await tx.productIngredient.createMany({
        data: validated.ingredients.map((ingredient) => ({
          productId: validated.id,
          itemDefinitionId: ingredient.itemDefinitionId,
          inventoryItemId: null,
          quantity: ingredient.quantity,
          width: ingredient.width ?? null,
          height: ingredient.height ?? null,
        })),
      });

      return await tx.product.findUnique({
        where: { id: validated.id },
        include: {
          ingredients: {
            include: {
              itemDefinition: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                },
              },
              inventoryItem: {
                select: {
                  id: true,
                  name: true,
                  width: true,
                  height: true,
                  thickness: true,
                  price: true,
                  status: true,
                },
              },
            },
          },
        },
      });
    });

    return {
      success: true,
      data: updated,
      message: 'Produkt byl úspěšně upraven',
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Neplatná data',
      };
    }
    console.error('Error updating product:', error);
    return {
      success: false,
      error: 'Nepodařilo se upravit produkt',
    };
  }
}

// Delete product and its ingredients
export async function deleteProduct(data: z.infer<typeof deleteProductSchema>) {
  try {
    const validated = deleteProductSchema.parse(data);

    // Get product to check for photoUrl
    const product = await prisma.product.findUnique({
      where: { id: validated.id },
      select: { photoUrl: true },
    });

    if (!product) {
      return {
        success: false,
        error: 'Produkt nenalezen',
      };
    }

    // Delete product and ingredients in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete ingredients (cascade should handle this, but explicit is safer)
      await tx.productIngredient.deleteMany({
        where: { productId: validated.id },
      });

      // Delete product
      await tx.product.delete({
        where: { id: validated.id },
      });
    });

    // Optionally delete image from Supabase Storage
    if (product.photoUrl) {
      try {
        // photoUrl is now a path, not a full URL, so we can use it directly
        await supabase.storage.from('products').remove([product.photoUrl]);
      } catch (storageError) {
        // Log but don't fail the deletion if storage delete fails
        console.error('Error deleting image from storage:', storageError);
      }
    }

    return {
      success: true,
      message: 'Produkt byl úspěšně smazán',
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || 'Neplatná data',
      };
    }
    console.error('Error deleting product:', error);
    return {
      success: false,
      error: 'Nepodařilo se smazat produkt',
    };
  }
}

// Upload product image to Supabase Storage
export async function uploadProductImage(formData: FormData) {
  try {
    const file = formData.get('file') as File;

    if (!file) {
      return {
        success: false,
        error: 'Soubor nebyl nahrán',
      };
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Neplatný typ souboru. Povolené typy: JPG, PNG, WEBP, GIF',
      };
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'Soubor je příliš velký. Maximální velikost je 5MB',
      };
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = fileName;

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('products')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Supabase storage error:', error);
      return {
        success: false,
        error: 'Nepodařilo se nahrát obrázek',
      };
    }

    // Return the file path (not a public URL) - this will be stored in the database
    // Signed URLs will be generated when fetching products
    return {
      success: true,
      path: data.path,
    };
  } catch (error) {
    console.error('Error uploading product image:', error);
    return {
      success: false,
      error: 'Nepodařilo se nahrát obrázek',
    };
  }
}
