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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  createItemDefinition,
  updateItemDefinition,
} from '@/app/actions/item-definitions';
import { useToast } from '@/hooks/use-toast';
import type { ItemDefinition } from '@prisma/client';

const categoryEnum = z.enum(['SHEET_MATERIAL', 'COMPONENT', 'OTHER']);

const definitionFormSchema = z.object({
  name: z.string().min(1, 'Název je povinný'),
  category: categoryEnum,
  description: z.string().optional(),
  propertiesJson: z.string().optional(),
});

type DefinitionForm = z.infer<typeof definitionFormSchema>;

const CATEGORY_OPTIONS: { value: 'SHEET_MATERIAL' | 'COMPONENT' | 'OTHER'; label: string }[] = [
  { value: 'SHEET_MATERIAL', label: 'Deskový materiál' },
  { value: 'COMPONENT', label: 'Komponent' },
  { value: 'OTHER', label: 'Ostatní' },
];

interface DefinitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialData?: ItemDefinition | null;
}

export function DefinitionDialog({
  open,
  onOpenChange,
  onSuccess,
  initialData,
}: DefinitionDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const isEdit = initialData != null;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<DefinitionForm>({
    resolver: zodResolver(definitionFormSchema) as Resolver<DefinitionForm>,
    defaultValues: {
      name: '',
      category: 'OTHER',
      description: '',
      propertiesJson: '',
    },
  });

  const category = watch('category');

  useEffect(() => {
    if (open && initialData) {
      reset({
        name: initialData.name,
        category: initialData.category,
        description: initialData.description ?? '',
        propertiesJson:
          initialData.properties != null &&
          typeof initialData.properties === 'object'
            ? JSON.stringify(initialData.properties as Record<string, unknown>, null, 2)
            : '',
      });
    } else if (open && !initialData) {
      reset({
        name: '',
        category: 'OTHER',
        description: '',
        propertiesJson: '',
      });
    }
  }, [open, initialData, reset]);

  const parseProperties = (
    raw: string | undefined
  ): Record<string, string | number | boolean> | undefined => {
    if (!raw?.trim()) return undefined;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string | number | boolean>;
      }
      return undefined;
    } catch {
      return undefined;
    }
  };

  const onSubmit = async (data: DefinitionForm) => {
    const properties = parseProperties(data.propertiesJson);
    if (data.propertiesJson?.trim() && properties === undefined) {
      toast({
        title: 'Chyba',
        description: 'Vlastnosti musí být platný JSON objekt',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      if (isEdit && initialData) {
        const result = await updateItemDefinition({
          id: initialData.id,
          name: data.name,
          category: data.category,
          description: data.description || null,
          properties,
        });
        if (result.success) {
          onSuccess();
          onOpenChange(false);
        } else {
          toast({
            title: 'Chyba',
            description: result.error || 'Nepodařilo se aktualizovat definici',
            variant: 'destructive',
          });
        }
      } else {
        const result = await createItemDefinition({
          name: data.name,
          category: data.category,
          description: data.description || null,
          properties,
        });
        if (result.success) {
          onSuccess();
          onOpenChange(false);
        } else {
          toast({
            title: 'Chyba',
            description: result.error || 'Nepodařilo se vytvořit definici',
            variant: 'destructive',
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Upravit definici' : 'Přidat definici'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Změňte údaje definice položky.'
              : 'Vyplňte údaje pro novou definici položky v katalogu.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Název</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="např. Bříza 18mm"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Kategorie</Label>
            <RadioGroup
              value={category}
              onValueChange={(value) =>
                setValue('category', value as DefinitionForm['category'])
              }
              className="flex flex-col gap-2"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={opt.value} />
                  <Label htmlFor={opt.value} className="font-normal cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {errors.category && (
              <p className="text-sm text-destructive">
                {errors.category.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Popis</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Volitelný popis"
              rows={2}
            />
            {errors.description && (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="propertiesJson">Vlastnosti (JSON)</Label>
            <Textarea
              id="propertiesJson"
              {...register('propertiesJson')}
              placeholder='{"tloušťka": 18} nebo {"barva": "stříbrná"}'
              rows={3}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Zadejte JSON objekt, např. {`{"tloušťka": 18}`}
            </p>
            {errors.propertiesJson && (
              <p className="text-sm text-destructive">
                {errors.propertiesJson.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Zrušit
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Ukládám...' : isEdit ? 'Uložit' : 'Vytvořit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
