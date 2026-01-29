'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { createOrder } from '@/app/actions/orders';
import { useToast } from '@/hooks/use-toast';
import { createOrderSchema, type CreateOrderInput } from '@/lib/schemas/orders';

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateOrderDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateOrderDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateOrderInput>({
    resolver: zodResolver(createOrderSchema) as Resolver<CreateOrderInput>,
    defaultValues: {
      name: '',
      status: 'DRAFT',
    },
  });

  const onSubmit = async (data: CreateOrderInput) => {
    setLoading(true);
    const result = await createOrder(data);
    setLoading(false);

    if (result.success && result.data) {
      reset();
      onSuccess();
      toast({
        title: 'Úspěch',
        description: result.message || 'Objednávka byla úspěšně vytvořena',
      });
      // Redirect to order detail page
      const orderId = (result as any).orderId || result.data.id;
      if (orderId) {
        router.push(`/orders/${orderId}`);
      }
    } else {
      toast({
        title: 'Chyba',
        description: result.error || 'Nepodařilo se vytvořit objednávku',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>Vytvořit objednávku</DialogTitle>
          <DialogDescription>
            Zadejte název pro novou objednávku.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className='grid gap-4 py-4'>
            <div className='grid gap-2'>
              <Label htmlFor='name'>Název *</Label>
              <Input
                id='name'
                {...register('name')}
                placeholder='Např. Kuchyň Novák'
              />
              {errors.name && (
                <p className='text-sm text-red-500'>{errors.name.message}</p>
              )}
            </div>
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
            <Button type='submit' disabled={loading}>
              {loading ? 'Vytváření...' : 'Vytvořit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
