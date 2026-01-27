'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createProduct, uploadProductImage } from '@/app/actions/products';
import { type CreateProductInput } from '@/lib/schemas/products';
import { getInventoryItems } from '@/app/actions/inventory';
import { RecipeEditor, type RecipeIngredient } from './recipe-editor';
import { useToast } from '@/hooks/use-toast';
import type { InventoryItem } from '@prisma/client';
import { ImageIcon } from 'lucide-react';

const createProductFormSchema = z.object({
  name: z.string().min(1, 'Název je povinný'),
  description: z.string().optional(),
  sellingPrice: z.coerce.number().positive('Cena musí být kladné číslo'),
  productionSteps: z.string().optional(),
});

type CreateProductForm = z.infer<typeof createProductFormSchema>;

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateProductDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
  const [ingredientErrors, setIngredientErrors] = useState<
    Array<{ inventoryItemId?: string; quantity?: string }>
  >([]);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<CreateProductForm>({
    resolver: zodResolver(createProductFormSchema),
    defaultValues: {
      description: '',
      productionSteps: '',
    },
  });

  // Fetch available inventory items
  useEffect(() => {
    if (open) {
      const loadItems = async () => {
        const result = await getInventoryItems();
        if (result.success && result.data) {
          // Filter only AVAILABLE items
          const available = result.data.filter(
            (item) => item.status === 'AVAILABLE',
          );
          setAvailableItems(available);
        }
      };
      loadItems();
    }
  }, [open]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      reset();
      setIngredients([]);
      setImageFile(null);
      setImagePreview(null);
      setPhotoUrl('');
      setIngredientErrors([]);
    }
  }, [open, reset]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = async (): Promise<string | null> => {
    if (!imageFile) return null;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', imageFile);

      const result = await uploadProductImage(formData);
      setUploadingImage(false);

      // uploadProductImage now returns the file path (not a URL)
      // This path will be stored in the database and signed URLs will be generated when fetching products
      if (result.success && result.path) {
        return result.path;
      } else {
        toast({
          title: 'Chyba',
          description: result.error || 'Nepodařilo se nahrát obrázek',
          variant: 'destructive',
        });
        return null;
      }
    } catch (error) {
      setUploadingImage(false);
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se nahrát obrázek',
        variant: 'destructive',
      });
      return null;
    }
  };

  const onSubmit = async (data: CreateProductForm) => {
    // Validate ingredients
    const errors: Array<{ inventoryItemId?: string; quantity?: string }> = [];
    let hasErrors = false;

    if (ingredients.length === 0) {
      toast({
        title: 'Chyba',
        description: 'Produkt musí mít alespoň jednu ingredienci',
        variant: 'destructive',
      });
      return;
    }

    ingredients.forEach((ingredient, index) => {
      const error: { inventoryItemId?: string; quantity?: string } = {};
      if (!ingredient.inventoryItemId) {
        error.inventoryItemId = 'Vyberte položku skladu';
        hasErrors = true;
      }
      if (!ingredient.quantity || ingredient.quantity <= 0) {
        error.quantity = 'Množství musí být kladné číslo';
        hasErrors = true;
      }
      errors.push(error);
    });

    if (hasErrors) {
      setIngredientErrors(errors);
      return;
    }

    setIngredientErrors([]);
    setLoading(true);

    try {
      // Upload image first if provided
      // Note: photoUrl now stores the file path (not a URL) in the database
      // Signed URLs will be generated when fetching products
      let finalPhotoPath = photoUrl;
      if (imageFile && !photoUrl) {
        const uploadedPath = await handleImageUpload();
        if (uploadedPath) {
          finalPhotoPath = uploadedPath;
        } else {
          setLoading(false);
          return; // Error already shown in handleImageUpload
        }
      }

      // Create product
      const productData: CreateProductInput = {
        name: data.name,
        description: data.description || undefined,
        sellingPrice: data.sellingPrice,
        productionSteps: data.productionSteps || undefined,
        photoUrl: finalPhotoPath || undefined,
        ingredients: ingredients,
      };

      const result = await createProduct(productData);
      setLoading(false);

      if (result.success) {
        toast({
          title: 'Úspěch',
          description: result.message || 'Produkt byl úspěšně vytvořen',
        });
        onSuccess();
        onOpenChange(false);
      } else {
        toast({
          title: 'Chyba',
          description: result.error || 'Nepodařilo se vytvořit produkt',
          variant: 'destructive',
        });
      }
    } catch (error) {
      setLoading(false);
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se vytvořit produkt',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[700px] max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Vytvořit produkt</DialogTitle>
          <DialogDescription>
            Vyplňte údaje o produktu a přidejte recepturu (ingredience).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className='grid gap-4 py-4'>
            {/* Basic Information */}
            <div className='grid gap-2'>
              <Label htmlFor='name'>Název *</Label>
              <Input
                id='name'
                {...register('name')}
                placeholder='Např. Stůl'
              />
              {errors.name && (
                <p className='text-sm text-red-500'>{errors.name.message}</p>
              )}
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='description'>Popis</Label>
              <Textarea
                id='description'
                {...register('description')}
                placeholder='Popis produktu...'
                rows={3}
              />
              {errors.description && (
                <p className='text-sm text-red-500'>
                  {errors.description.message}
                </p>
              )}
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='sellingPrice'>Prodejní cena (Kč) *</Label>
              <Input
                id='sellingPrice'
                type='number'
                step='0.01'
                {...register('sellingPrice')}
                placeholder='0.00'
              />
              {errors.sellingPrice && (
                <p className='text-sm text-red-500'>
                  {errors.sellingPrice.message}
                </p>
              )}
            </div>

            <div className='grid gap-2'>
              <Label htmlFor='productionSteps'>Výrobní kroky</Label>
              <Textarea
                id='productionSteps'
                {...register('productionSteps')}
                placeholder='Popis výrobních kroků...'
                rows={4}
              />
              {errors.productionSteps && (
                <p className='text-sm text-red-500'>
                  {errors.productionSteps.message}
                </p>
              )}
            </div>

            {/* Image Upload */}
            <div className='grid gap-2'>
              <Label>Fotografie produktu</Label>
              <div className='flex items-center gap-4'>
                <div className='flex-1'>
                  <Input
                    type='file'
                    accept='image/*'
                    onChange={handleImageChange}
                    className='cursor-pointer'
                  />
                </div>
                {imagePreview && (
                  <div className='relative w-20 h-20 rounded-md overflow-hidden border'>
                    <img
                      src={imagePreview}
                      alt='Preview'
                      className='w-full h-full object-cover'
                    />
                  </div>
                )}
              </div>
              {!imagePreview && !photoUrl && (
                <div className='flex items-center justify-center w-20 h-20 border-2 border-dashed rounded-md text-muted-foreground'>
                  <ImageIcon className='h-8 w-8' />
                </div>
              )}
              {photoUrl && !imagePreview && (
                <div className='relative w-20 h-20 rounded-md overflow-hidden border'>
                  <img
                    src={photoUrl}
                    alt='Product'
                    className='w-full h-full object-cover'
                  />
                </div>
              )}
            </div>

            {/* Recipe Editor */}
            <RecipeEditor
              ingredients={ingredients}
              onChange={setIngredients}
              availableItems={availableItems}
              errors={ingredientErrors}
            />
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={loading || uploadingImage}
            >
              Zrušit
            </Button>
            <Button type='submit' disabled={loading || uploadingImage}>
              {loading || uploadingImage ? 'Vytváření...' : 'Vytvořit produkt'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
