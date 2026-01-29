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
import { Combobox } from '@/components/ui/combobox';
import { addInventoryItem } from '@/app/actions/inventory';
import { getAllItemDefinitions } from '@/app/actions/item-definitions';
import { useToast } from '@/hooks/use-toast';
import type { ItemDefinition } from '@prisma/client';

const CATEGORY_LABELS: Record<string, string> = {
  SHEET_MATERIAL: 'Deskový materiál',
  COMPONENT: 'Komponent',
  OTHER: 'Ostatní',
};

const addItemSchema = z
  .object({
    itemDefinitionId: z.string().min(1, 'Vyberte definici položky'),
    note: z.string().optional(),
    width: z.coerce.number().positive('Šířka musí být kladné číslo'),
    height: z.coerce.number().positive('Výška musí být kladné číslo'),
    thickness: z.coerce.number().positive('Tloušťka musí být kladné číslo'),
    quantity: z.coerce
      .number()
      .int()
      .positive('Množství musí být kladné celé číslo')
      .default(1),
    totalPrice: z.coerce
      .number()
      .nonnegative('Celková cena musí být nezáporné číslo'),
  })
  .refine((data) => data.itemDefinitionId !== '', {
    message: 'Vyberte definici položky',
    path: ['itemDefinitionId'],
  });

type AddItemForm = z.infer<typeof addItemSchema>;

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddItemDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddItemDialogProps) {
  const [loading, setLoading] = useState(false);
  const [definitions, setDefinitions] = useState<ItemDefinition[]>([]);
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
    setValue,
  } = useForm<AddItemForm>({
    resolver: zodResolver(addItemSchema) as Resolver<AddItemForm>,
    defaultValues: {
      itemDefinitionId: '',
      note: '',
      quantity: 1,
      totalPrice: 0,
    },
  });

  const itemDefinitionIdStr = watch('itemDefinitionId');
  const quantity = watch('quantity');
  const totalPrice = watch('totalPrice');
  const unitPrice = quantity > 0 && totalPrice > 0 ? totalPrice / quantity : 0;
  const selectedDefinition = definitions.find(
    (d) => String(d.id) === itemDefinitionIdStr,
  );

  useEffect(() => {
    if (open) {
      getAllItemDefinitions().then((result) => {
        if (result.success && result.data) {
          setDefinitions(result.data);
        }
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      reset({
        itemDefinitionId: '',
        note: '',
        quantity: 1,
        totalPrice: 0,
      });
    }
  }, [open, reset]);

  const comboboxOptions = definitions.map((d) => ({
    value: String(d.id),
    label: `${d.name} (${CATEGORY_LABELS[d.category] ?? d.category})`,
  }));

  const onSubmit = async (data: AddItemForm) => {
    setLoading(true);
    const result = await addInventoryItem({
      itemDefinitionId: parseInt(data.itemDefinitionId, 10),
      note: data.note?.trim() || undefined,
      width: data.width,
      height: data.height,
      thickness: data.thickness,
      quantity: data.quantity,
      totalPrice: data.totalPrice,
    });
    setLoading(false);

    if (result.success) {
      reset();
      onSuccess();
      toast({
        title: 'Úspěch',
        description: result.message ?? 'Položka byla přidána',
      });
    } else {
      toast({
        title: 'Chyba',
        description: result.error ?? 'Nepodařilo se přidat položku',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Přidat položku do skladu</DialogTitle>
          <DialogDescription>
            Vyberte definici z katalogu a vyplňte rozměry. Můžete přidat více
            kusů najednou.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Definice položky *</Label>
              <Combobox
                options={comboboxOptions}
                value={itemDefinitionIdStr}
                onValueChange={(value) => setValue('itemDefinitionId', value)}
                placeholder="Vyberte z katalogu"
                searchPlaceholder="Hledat definici..."
                emptyText="Žádné definice. Nejdřív přidejte definice v Katalogu."
              />
              {errors.itemDefinitionId && (
                <p className="text-sm text-red-500">
                  {errors.itemDefinitionId.message}
                </p>
              )}
            </div>

            {selectedDefinition && (
              <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                Kategorie:{' '}
                {CATEGORY_LABELS[selectedDefinition.category] ??
                  selectedDefinition.category}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="note">Poznámka (volitelné)</Label>
              <Input
                id="note"
                {...register('note')}
                placeholder="Např. dodávka 1"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="width">Šířka (mm) *</Label>
                <Input
                  id="width"
                  type="number"
                  step="0.01"
                  {...register('width')}
                  placeholder="0"
                />
                {errors.width && (
                  <p className="text-sm text-red-500">{errors.width.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="height">Výška (mm) *</Label>
                <Input
                  id="height"
                  type="number"
                  step="0.01"
                  {...register('height')}
                  placeholder="0"
                />
                {errors.height && (
                  <p className="text-sm text-red-500">
                    {errors.height.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="thickness">Tloušťka (mm) *</Label>
                <Input
                  id="thickness"
                  type="number"
                  step="0.01"
                  {...register('thickness')}
                  placeholder="0"
                />
                {errors.thickness && (
                  <p className="text-sm text-red-500">
                    {errors.thickness.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="quantity">Množství *</Label>
                <Input
                  id="quantity"
                  type="number"
                  {...register('quantity')}
                  placeholder="1"
                />
                {errors.quantity && (
                  <p className="text-sm text-red-500">
                    {errors.quantity.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="totalPrice">Celková cena (Kč) *</Label>
                <Input
                  id="totalPrice"
                  type="number"
                  step="0.01"
                  {...register('totalPrice')}
                  placeholder="0"
                />
                {errors.totalPrice && (
                  <p className="text-sm text-red-500">
                    {errors.totalPrice.message}
                  </p>
                )}
              </div>
            </div>

            {unitPrice > 0 && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">
                  Cena za kus:{' '}
                  <span className="font-semibold">
                    {unitPrice.toFixed(2)} Kč
                  </span>
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Zrušit
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Přidávám...' : 'Přidat'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
