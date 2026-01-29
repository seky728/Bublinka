'use client';

import { useState, useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
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
import { updateProduct, uploadProductImage, getProduct } from '@/app/actions/products';
import { type UpdateProductInput } from '@/lib/schemas/products';
import { getAllItemDefinitions } from '@/app/actions/item-definitions';
import { RecipeEditor, type RecipeIngredient, type RecipeIngredientErrors } from './recipe-editor';
import { useToast } from '@/hooks/use-toast';
import type { ItemDefinition } from '@prisma/client';
import { ImageIcon } from 'lucide-react';

const editProductFormSchema = z.object({
  name: z.string().min(1, 'Název je povinný'),
  description: z.string().optional(),
  sellingPrice: z.coerce.number().positive('Cena musí být kladné číslo'),
  productionSteps: z.string().optional(),
});

type EditProductForm = z.infer<typeof editProductFormSchema>;

type ProductForEdit = Awaited<ReturnType<typeof getProduct>>['data'];

interface EditProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  productId: string | null;
}

export function EditProductDialog({
  open,
  onOpenChange,
  onSuccess,
  productId,
}: EditProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [definitions, setDefinitions] = useState<ItemDefinition[]>([]);
  const [ingredientErrors, setIngredientErrors] = useState<RecipeIngredientErrors[]>([]);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EditProductForm>({
    resolver: zodResolver(editProductFormSchema) as Resolver<EditProductForm>,
    defaultValues: {
      name: '',
      description: '',
      sellingPrice: 0,
      productionSteps: '',
    },
  });

  // Fetch definitions when dialog opens
  useEffect(() => {
    if (open) {
      getAllItemDefinitions().then((result) => {
        if (result.success && result.data) {
          setDefinitions(result.data);
        }
      });
    }
  }, [open]);

  // Load product when dialog opens with productId
  useEffect(() => {
    if (!open || !productId) {
      return;
    }
    setLoadingProduct(true);
    getProduct(productId)
      .then((result) => {
        if (result.success && result.data) {
          const product = result.data as ProductForEdit & { imageUrl?: string | null };
          reset({
            name: product.name,
            description: product.description ?? '',
            sellingPrice: product.sellingPrice,
            productionSteps: product.productionSteps ?? '',
          });
          setPhotoUrl(product.photoUrl ?? '');
          setExistingImageUrl(product.imageUrl ?? null);
          setIngredients(
            product.ingredients.map((ing) => ({
              itemDefinitionId: ing.itemDefinition?.id ?? 0,
              quantity: ing.quantity,
              width: ing.width ?? undefined,
              height: ing.height ?? undefined,
            })),
          );
        } else {
          toast({
            title: 'Chyba',
            description: result.error ?? 'Nepodařilo se načíst produkt',
            variant: 'destructive',
          });
          onOpenChange(false);
        }
      })
      .finally(() => setLoadingProduct(false));
  }, [open, productId, reset, onOpenChange, toast]);

  // Reset image state when dialog closes
  useEffect(() => {
    if (!open) {
      setImageFile(null);
      setImagePreview(null);
      setExistingImageUrl(null);
      setIngredientErrors([]);
    }
  }, [open]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
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
      if (result.success && result.path) {
        return result.path;
      }
      toast({
        title: 'Chyba',
        description: result.error ?? 'Nepodařilo se nahrát obrázek',
        variant: 'destructive',
      });
      return null;
    } catch {
      setUploadingImage(false);
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se nahrát obrázek',
        variant: 'destructive',
      });
      return null;
    }
  };

  const onSubmit = async (data: EditProductForm) => {
    const errorsList: RecipeIngredientErrors[] = [];
    let hasErrors = false;

    if (ingredients.length === 0) {
      toast({
        title: 'Chyba',
        description: 'Produkt musí mít alespoň jednu ingredienci',
        variant: 'destructive',
      });
      return;
    }

    ingredients.forEach((ingredient) => {
      const error: RecipeIngredientErrors = {};
      const def = definitions.find((d) => d.id === ingredient.itemDefinitionId);

      if (!ingredient.itemDefinitionId || ingredient.itemDefinitionId <= 0) {
        error.itemDefinitionId = 'Vyberte definici položky';
        hasErrors = true;
      }
      if (!ingredient.quantity || ingredient.quantity <= 0) {
        error.quantity = 'Množství musí být kladné číslo';
        hasErrors = true;
      }
      if (def?.category === 'SHEET_MATERIAL') {
        if (ingredient.width == null || ingredient.width <= 0) {
          error.width = 'Šířka je povinná u deskového materiálu';
          hasErrors = true;
        }
        if (ingredient.height == null || ingredient.height <= 0) {
          error.height = 'Výška je povinná u deskového materiálu';
          hasErrors = true;
        }
      }
      errorsList.push(error);
    });

    if (hasErrors) {
      setIngredientErrors(errorsList);
      return;
    }

    setIngredientErrors([]);
    setLoading(true);

    try {
      let finalPhotoPath = photoUrl;
      if (imageFile) {
        const uploadedPath = await handleImageUpload();
        if (uploadedPath) {
          finalPhotoPath = uploadedPath;
        } else {
          setLoading(false);
          return;
        }
      }

      const productData: UpdateProductInput = {
        id: productId!,
        name: data.name,
        description: data.description || undefined,
        sellingPrice: data.sellingPrice,
        productionSteps: data.productionSteps || undefined,
        photoUrl: finalPhotoPath || undefined,
        ingredients: ingredients.map((i) => ({
          itemDefinitionId: i.itemDefinitionId,
          quantity: i.quantity,
          width: i.width ?? undefined,
          height: i.height ?? undefined,
        })),
      };

      const result = await updateProduct(productData);
      setLoading(false);

      if (result.success) {
        toast({
          title: 'Úspěch',
          description: result.message ?? 'Produkt byl úspěšně upraven',
        });
        onSuccess();
        onOpenChange(false);
      } else {
        toast({
          title: 'Chyba',
          description: result.error ?? 'Nepodařilo se upravit produkt',
          variant: 'destructive',
        });
      }
    } catch {
      setLoading(false);
      toast({
        title: 'Chyba',
        description: 'Nepodařilo se upravit produkt',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upravit produkt</DialogTitle>
          <DialogDescription>
            Upravte údaje o produktu a recepturu (ingredience).
          </DialogDescription>
        </DialogHeader>

        {loadingProduct ? (
          <div className="py-8 text-center text-muted-foreground">Načítání...</div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Název *</Label>
                <Input
                  id="edit-name"
                  {...register('name')}
                  placeholder="Např. Stůl"
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-description">Popis</Label>
                <Textarea
                  id="edit-description"
                  {...register('description')}
                  placeholder="Popis produktu..."
                  rows={3}
                />
                {errors.description && (
                  <p className="text-sm text-red-500">{errors.description.message}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-sellingPrice">Prodejní cena (Kč) *</Label>
                <Input
                  id="edit-sellingPrice"
                  type="number"
                  step="0.01"
                  {...register('sellingPrice')}
                  placeholder="0.00"
                />
                {errors.sellingPrice && (
                  <p className="text-sm text-red-500">{errors.sellingPrice.message}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-productionSteps">Výrobní kroky</Label>
                <Textarea
                  id="edit-productionSteps"
                  {...register('productionSteps')}
                  placeholder="Popis výrobních kroků..."
                  rows={4}
                />
                {errors.productionSteps && (
                  <p className="text-sm text-red-500">{errors.productionSteps.message}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Fotografie produktu</Label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="cursor-pointer"
                    />
                  </div>
                  {imagePreview && (
                    <div className="relative w-20 h-20 rounded-md overflow-hidden border">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {!imagePreview && !photoUrl && (
                    <div className="flex items-center justify-center w-20 h-20 border-2 border-dashed rounded-md text-muted-foreground">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                  {photoUrl && !imagePreview && (
                    <div className="relative w-20 h-20 rounded-md overflow-hidden border">
                      {existingImageUrl ? (
                        <img
                          src={existingImageUrl}
                          alt="Product"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">Obrázek v DB</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <RecipeEditor
                ingredients={ingredients}
                onChange={setIngredients}
                definitions={definitions}
                errors={ingredientErrors}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading || uploadingImage}
              >
                Zrušit
              </Button>
              <Button type="submit" disabled={loading || uploadingImage}>
                {loading || uploadingImage ? 'Ukládání...' : 'Uložit změny'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
