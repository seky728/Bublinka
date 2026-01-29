'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { cutInventoryItem } from '@/app/actions/inventory';
import { useToast } from '@/hooks/use-toast';
import type { InventoryItem } from '@prisma/client';

const cutItemSchema = z.object({
  cutWidth: z.coerce.number().positive('Šířka řezu musí být kladné číslo'),
  cutHeight: z.coerce.number().positive('Výška řezu musí být kladné číslo'),
  direction: z.enum(['horizontal', 'vertical']),
  saveMainRemnant: z.boolean(),
  saveSecondaryRemnant: z.boolean(),
});

type CutItemForm = z.infer<typeof cutItemSchema>;

interface CutItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem;
  onSuccess: () => void;
}

export function CutItemDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
}: CutItemDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<CutItemForm>({
    resolver: zodResolver(cutItemSchema) as Resolver<CutItemForm>,
    defaultValues: {
      direction: 'horizontal',
      saveMainRemnant: true,
      saveSecondaryRemnant: false,
    },
  });

  const cutWidth = watch('cutWidth');
  const cutHeight = watch('cutHeight');
  const direction = watch('direction');
  const saveMainRemnant = watch('saveMainRemnant');
  const saveSecondaryRemnant = watch('saveSecondaryRemnant');

  // Calculate remnants
  const remnants = useMemo(() => {
    if (!cutWidth || !cutHeight || cutWidth <= 0 || cutHeight <= 0) {
      return { main: null, secondary: null };
    }

    let main: { width: number; height: number; thickness: number } | null =
      null;
    let secondary: {
      width: number;
      height: number;
      thickness: number;
    } | null = null;

    if (direction === 'horizontal') {
      if (cutWidth > item.width) {
        return { main: null, secondary: null };
      }
      main = {
        width: item.width - cutWidth,
        height: item.height,
        thickness: item.thickness,
      };
      if (cutHeight < item.height) {
        secondary = {
          width: cutWidth,
          height: item.height - cutHeight,
          thickness: item.thickness,
        };
      }
    } else {
      if (cutHeight > item.height) {
        return { main: null, secondary: null };
      }
      main = {
        width: item.width,
        height: item.height - cutHeight,
        thickness: item.thickness,
      };
      if (cutWidth < item.width) {
        secondary = {
          width: item.width - cutWidth,
          height: cutHeight,
          thickness: item.thickness,
        };
      }
    }

    return { main, secondary };
  }, [cutWidth, cutHeight, direction, item]);

  // Calculate prices
  const prices = useMemo(() => {
    if (!remnants.main && !remnants.secondary) {
      return { main: 0, secondary: 0 };
    }

    const originalArea = item.width * item.height;
    const mainArea = remnants.main
      ? remnants.main.width * remnants.main.height
      : 0;
    const secondaryArea = remnants.secondary
      ? remnants.secondary.width * remnants.secondary.height
      : 0;

    const mainPrice = (item.price * mainArea) / originalArea;
    const secondaryPrice = (item.price * secondaryArea) / originalArea;

    return { main: mainPrice, secondary: secondaryPrice };
  }, [remnants, item]);

  const handleConsumeWhole = () => {
    setValue('cutWidth', item.width);
    setValue('cutHeight', item.height);
    setValue('saveMainRemnant', false);
    setValue('saveSecondaryRemnant', false);
  };

  const isConsumeWhole = cutWidth === item.width && cutHeight === item.height;

  useEffect(() => {
    if (open) {
      reset({
        cutWidth: 0,
        cutHeight: 0,
        direction: 'horizontal',
        saveMainRemnant: true,
        saveSecondaryRemnant: false,
      });
    }
  }, [open, reset]);

  const onSubmit = async (data: CutItemForm) => {
    setLoading(true);
    const result = await cutInventoryItem({
      id: item.id,
      ...data,
    });
    setLoading(false);

    if (result.success) {
      reset();
      onSuccess();
    } else {
      toast({
        title: 'Chyba',
        description: result.error || 'Nepodařilo se provést řezání',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className='sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle>Řezat položku: {item.name}</DialogTitle>
          <DialogDescription>
            Původní rozměry: {item.width} × {item.height} × {item.thickness} mm
            | Cena: {item.price.toFixed(2)} Kč
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className='grid gap-4 py-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='grid gap-2'>
                <Label htmlFor='cutWidth'>Šířka řezu (mm) *</Label>
                <Input
                  id='cutWidth'
                  type='number'
                  step='0.01'
                  {...register('cutWidth')}
                  placeholder='0'
                  disabled={isConsumeWhole}
                />
                {errors.cutWidth && (
                  <p className='text-sm text-red-500'>
                    {errors.cutWidth.message}
                  </p>
                )}
              </div>

              <div className='grid gap-2'>
                <Label htmlFor='cutHeight'>Výška řezu (mm) *</Label>
                <Input
                  id='cutHeight'
                  type='number'
                  step='0.01'
                  {...register('cutHeight')}
                  placeholder='0'
                  disabled={isConsumeWhole}
                />
                {errors.cutHeight && (
                  <p className='text-sm text-red-500'>
                    {errors.cutHeight.message}
                  </p>
                )}
              </div>
            </div>

            <div className='grid gap-2'>
              <Label>Směr řezu</Label>
              <RadioGroup
                value={direction}
                onValueChange={(value) =>
                  setValue('direction', value as 'horizontal' | 'vertical')
                }
                disabled={isConsumeWhole}
              >
                <div className='flex items-center space-x-2'>
                  <RadioGroupItem
                    value='horizontal'
                    id='horizontal'
                  />
                  <Label
                    htmlFor='horizontal'
                    className='cursor-pointer'
                  >
                    Horizontální (řez podél šířky)
                  </Label>
                </div>
                <div className='flex items-center space-x-2'>
                  <RadioGroupItem
                    value='vertical'
                    id='vertical'
                  />
                  <Label
                    htmlFor='vertical'
                    className='cursor-pointer'
                  >
                    Vertikální (řez podél výšky)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className='flex justify-end'>
              <Button
                type='button'
                variant='outline'
                onClick={handleConsumeWhole}
              >
                Spotřebovat celé
              </Button>
            </div>

            {remnants.main && (
              <div className='p-4 border rounded-md space-y-3'>
                <div className='flex items-center space-x-2'>
                  <Checkbox
                    id='saveMainRemnant'
                    checked={saveMainRemnant}
                    onCheckedChange={(checked) =>
                      setValue('saveMainRemnant', checked === true)
                    }
                    disabled={isConsumeWhole}
                  />
                  <Label
                    htmlFor='saveMainRemnant'
                    className='cursor-pointer'
                  >
                    Hlavní zbytek
                  </Label>
                </div>
                {saveMainRemnant && (
                  <div className='ml-6 space-y-1'>
                    <p className='text-sm'>
                      Rozměry: {remnants.main.width} × {remnants.main.height} ×{' '}
                      {remnants.main.thickness} mm
                    </p>
                    <p className='text-sm font-semibold'>
                      Cena: {prices.main.toFixed(2)} Kč
                    </p>
                  </div>
                )}
              </div>
            )}

            {remnants.secondary && (
              <div className='p-4 border rounded-md space-y-3'>
                <div className='flex items-center space-x-2'>
                  <Checkbox
                    id='saveSecondaryRemnant'
                    checked={saveSecondaryRemnant}
                    onCheckedChange={(checked) =>
                      setValue('saveSecondaryRemnant', checked === true)
                    }
                    disabled={isConsumeWhole}
                  />
                  <Label
                    htmlFor='saveSecondaryRemnant'
                    className='cursor-pointer'
                  >
                    Vedlejší zbytek
                  </Label>
                </div>
                {saveSecondaryRemnant && (
                  <div className='ml-6 space-y-1'>
                    <p className='text-sm'>
                      Rozměry: {remnants.secondary.width} ×{' '}
                      {remnants.secondary.height} ×{' '}
                      {remnants.secondary.thickness} mm
                    </p>
                    <p className='text-sm font-semibold'>
                      Cena: {prices.secondary.toFixed(2)} Kč
                    </p>
                  </div>
                )}
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
              {loading ? 'Řezám...' : 'Provést řezání'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
