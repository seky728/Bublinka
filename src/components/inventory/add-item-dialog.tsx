'use client';

import { useState } from 'react';
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
import { addInventoryItem } from '@/app/actions/inventory';
import { useToast } from '@/hooks/use-toast';

const addItemSchema = z.object({
  name: z.string().min(1, 'Název je povinný'),
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
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<AddItemForm>({
    resolver: zodResolver(addItemSchema),
    defaultValues: {
      quantity: 1,
      totalPrice: 0,
    },
  });

  const quantity = watch('quantity');
  const totalPrice = watch('totalPrice');
  const unitPrice = quantity > 0 && totalPrice > 0 ? totalPrice / quantity : 0;

  const onSubmit = async (data: AddItemForm) => {
    setLoading(true);
    const result = await addInventoryItem(data);
    setLoading(false);

    if (result.success) {
      reset();
      onSuccess();
    } else {
      toast({
        title: 'Chyba',
        description: result.error || 'Nepodařilo se přidat položku',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>Přidat položku do skladu</DialogTitle>
          <DialogDescription>
            Vyplňte údaje o položce. Můžete přidat více kusů najednou.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className='grid gap-4 py-4'>
            <div className='grid gap-2'>
              <Label htmlFor='name'>Název *</Label>
              <Input
                id='name'
                {...register('name')}
                placeholder='Např. Deska'
              />
              {errors.name && (
                <p className='text-sm text-red-500'>{errors.name.message}</p>
              )}
            </div>

            <div className='grid grid-cols-3 gap-4'>
              <div className='grid gap-2'>
                <Label htmlFor='width'>Šířka (mm) *</Label>
                <Input
                  id='width'
                  type='number'
                  step='0.01'
                  {...register('width')}
                  placeholder='0'
                />
                {errors.width && (
                  <p className='text-sm text-red-500'>{errors.width.message}</p>
                )}
              </div>

              <div className='grid gap-2'>
                <Label htmlFor='height'>Výška (mm) *</Label>
                <Input
                  id='height'
                  type='number'
                  step='0.01'
                  {...register('height')}
                  placeholder='0'
                />
                {errors.height && (
                  <p className='text-sm text-red-500'>
                    {errors.height.message}
                  </p>
                )}
              </div>

              <div className='grid gap-2'>
                <Label htmlFor='thickness'>Tloušťka (mm) *</Label>
                <Input
                  id='thickness'
                  type='number'
                  step='0.01'
                  {...register('thickness')}
                  placeholder='0'
                />
                {errors.thickness && (
                  <p className='text-sm text-red-500'>
                    {errors.thickness.message}
                  </p>
                )}
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='grid gap-2'>
                <Label htmlFor='quantity'>Množství *</Label>
                <Input
                  id='quantity'
                  type='number'
                  {...register('quantity')}
                  placeholder='1'
                />
                {errors.quantity && (
                  <p className='text-sm text-red-500'>
                    {errors.quantity.message}
                  </p>
                )}
              </div>

              <div className='grid gap-2'>
                <Label htmlFor='totalPrice'>Celková cena (Kč) *</Label>
                <Input
                  id='totalPrice'
                  type='number'
                  step='0.01'
                  {...register('totalPrice')}
                  placeholder='0'
                />
                {errors.totalPrice && (
                  <p className='text-sm text-red-500'>
                    {errors.totalPrice.message}
                  </p>
                )}
              </div>
            </div>

            {unitPrice > 0 && (
              <div className='p-3 bg-muted rounded-md'>
                <p className='text-sm text-muted-foreground'>
                  Cena za kus:{' '}
                  <span className='font-semibold'>
                    {unitPrice.toFixed(2)} Kč
                  </span>
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Zrušit
            </Button>
            <Button
              type='submit'
              disabled={loading}
            >
              {loading ? 'Přidávám...' : 'Přidat'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
