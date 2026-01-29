'use client';

import { useEffect, useState } from 'react';
import { getProducts, deleteProduct } from '../actions/products';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ImageIcon, Pencil } from 'lucide-react';
import { CreateProductDialog } from '@/components/products/create-product-dialog';
import { EditProductDialog } from '@/components/products/edit-product-dialog';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@prisma/client';

type ProductWithIngredients = Product & {
  ingredients: Array<{
    id: string;
    quantity: number;
    width?: number | null;
    height?: number | null;
    itemDefinition?: { id: number; name: string; category: string } | null;
    inventoryItem?: {
      id: string;
      name: string;
      width: number;
      height: number;
      thickness: number;
      price: number;
      status: string;
    } | null;
  }>;
};

function formatIngredientLine(
  name: string,
  quantity: number,
  width?: number | null,
  height?: number | null,
): string {
  if (width != null && height != null && width > 0 && height > 0) {
    return `${name} (${width} × ${height} mm) – ${quantity} ks`;
  }
  return `${quantity}× ${name}`;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductWithIngredients[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadProducts = async () => {
    setLoading(true);
    const result = await getProducts();
    if (result.success && result.data) {
      setProducts(result.data);
    } else {
      toast({
        title: 'Chyba',
        description: result.error || 'Nepodařilo se načíst produkty',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleCreateSuccess = () => {
    setCreateDialogOpen(false);
    loadProducts();
    toast({
      title: 'Úspěch',
      description: 'Produkt byl úspěšně vytvořen',
    });
  };

  const handleEditClick = (id: string) => {
    setEditingProductId(id);
    setEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    setEditDialogOpen(false);
    setEditingProductId(null);
    loadProducts();
    toast({
      title: 'Úspěch',
      description: 'Produkt byl úspěšně upraven',
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Opravdu chcete smazat tento produkt?')) {
      return;
    }

    setDeletingId(id);
    const result = await deleteProduct({ id });
    setDeletingId(null);

    if (result.success) {
      toast({
        title: 'Úspěch',
        description: result.message || 'Produkt byl úspěšně smazán',
      });
      loadProducts();
    } else {
      toast({
        title: 'Chyba',
        description: result.error || 'Nepodařilo se smazat produkt',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className='container mx-auto py-8 px-4'>
      <div className='flex justify-between items-center mb-6'>
        <h1 className='text-3xl font-bold'>Produkty</h1>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className='h-4 w-4 mr-2' />
          Přidat produkt
        </Button>
      </div>

      {loading ? (
        <div className='text-center py-8'>Načítání...</div>
      ) : products.length === 0 ? (
        <div className='text-center py-12 border rounded-lg'>
          <p className='text-muted-foreground mb-4'>Žádné produkty</p>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className='h-4 w-4 mr-2' />
            Vytvořit první produkt
          </Button>
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {products.map((product) => (
            <div
              key={product.id}
              className='border rounded-lg overflow-hidden hover:shadow-lg transition-shadow'
            >
              {/* Product Image */}
              <div className='aspect-video bg-muted flex items-center justify-center relative'>
                {product.photoUrl ? (
                  <img
                    src={product.photoUrl}
                    alt={product.name}
                    className='w-full h-full object-cover'
                  />
                ) : (
                  <ImageIcon className='h-12 w-12 text-muted-foreground' />
                )}
              </div>

              {/* Product Info */}
              <div className='p-4'>
                <h3 className='font-semibold text-lg mb-2'>{product.name}</h3>
                {product.description && (
                  <p className='text-sm text-muted-foreground mb-3 line-clamp-2'>
                    {product.description}
                  </p>
                )}
                <div className='flex items-center justify-between mb-3'>
                  <div>
                    <p className='text-sm text-muted-foreground'>Cena</p>
                    <p className='text-xl font-bold'>
                      {product.sellingPrice.toFixed(2)} Kč
                    </p>
                  </div>
                </div>

                {/* Ingredients Summary */}
                {product.ingredients.length > 0 && (
                  <div className='mb-3'>
                    <p className='text-xs text-muted-foreground mb-1'>
                      Ingredience ({product.ingredients.length}):
                    </p>
                    <div className='text-xs space-y-1'>
                      {product.ingredients.slice(0, 3).map((ingredient) => (
                        <div key={ingredient.id}>
                          {formatIngredientLine(
                            ingredient.itemDefinition?.name ??
                              ingredient.inventoryItem?.name ??
                              '—',
                            ingredient.quantity,
                            ingredient.width,
                            ingredient.height,
                          )}
                        </div>
                      ))}
                      {product.ingredients.length > 3 && (
                        <div className='text-muted-foreground'>
                          +{product.ingredients.length - 3} dalších
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className='flex gap-2 mt-4'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handleEditClick(product.id)}
                    className='flex-1'
                  >
                    <Pencil className='h-4 w-4 mr-2' />
                    Upravit
                  </Button>
                  <Button
                    variant='destructive'
                    size='sm'
                    onClick={() => handleDelete(product.id)}
                    disabled={deletingId === product.id}
                    className='flex-1'
                  >
                    <Trash2 className='h-4 w-4 mr-2' />
                    {deletingId === product.id ? 'Mazání...' : 'Smazat'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateProductDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />
      <EditProductDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={handleEditSuccess}
        productId={editingProductId}
      />
    </div>
  );
}
