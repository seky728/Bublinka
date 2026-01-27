'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Plus, Trash2 } from 'lucide-react';
import type { InventoryItem } from '@prisma/client';

export interface RecipeIngredient {
  inventoryItemId: string;
  quantity: number;
}

interface RecipeEditorProps {
  ingredients: RecipeIngredient[];
  onChange: (ingredients: RecipeIngredient[]) => void;
  availableItems: InventoryItem[];
  errors?: Array<{ inventoryItemId?: string; quantity?: string }>;
}

export function RecipeEditor({
  ingredients,
  onChange,
  availableItems,
  errors = [],
}: RecipeEditorProps) {
  const addIngredient = () => {
    onChange([
      ...ingredients,
      {
        inventoryItemId: '',
        quantity: 1,
      },
    ]);
  };

  const removeIngredient = (index: number) => {
    onChange(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (
    index: number,
    field: keyof RecipeIngredient,
    value: string | number,
  ) => {
    const updated = [...ingredients];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    onChange(updated);
  };

  // Convert inventory items to combobox options
  const comboboxOptions: ComboboxOption[] = availableItems.map((item) => ({
    value: item.id,
    label: `${item.name} (${item.width}×${item.height}×${item.thickness}mm)`,
  }));

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <label className='text-sm font-medium'>Ingredience (receptura)</label>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={addIngredient}
        >
          <Plus className='h-4 w-4 mr-2' />
          Přidat ingredienci
        </Button>
      </div>

      {ingredients.length === 0 ? (
        <div className='text-sm text-muted-foreground text-center py-4 border rounded-md'>
          Žádné ingredience. Klikněte na "Přidat ingredienci" pro přidání.
        </div>
      ) : (
        <div className='space-y-3'>
          {ingredients.map((ingredient, index) => {
            const itemErrors = errors[index] || {};
            const selectedItem = availableItems.find(
              (item) => item.id === ingredient.inventoryItemId,
            );

            return (
              <div
                key={index}
                className='flex gap-2 items-start p-3 border rounded-md'
              >
                <div className='flex-1 space-y-2'>
                  <div>
                    <Combobox
                      options={comboboxOptions}
                      value={ingredient.inventoryItemId}
                      onValueChange={(value) =>
                        updateIngredient(index, 'inventoryItemId', value)
                      }
                      placeholder='Vyberte položku skladu'
                      searchPlaceholder='Hledat položku...'
                      emptyText='Žádné dostupné položky'
                    />
                    {itemErrors.inventoryItemId && (
                      <p className='text-sm text-red-500 mt-1'>
                        {itemErrors.inventoryItemId}
                      </p>
                    )}
                  </div>
                  <div>
                    <Input
                      type='number'
                      step='0.01'
                      min='0.01'
                      placeholder='Množství'
                      value={ingredient.quantity || ''}
                      onChange={(e) =>
                        updateIngredient(
                          index,
                          'quantity',
                          parseFloat(e.target.value) || 0,
                        )
                      }
                    />
                    {itemErrors.quantity && (
                      <p className='text-sm text-red-500 mt-1'>
                        {itemErrors.quantity}
                      </p>
                    )}
                    {selectedItem && (
                      <p className='text-xs text-muted-foreground mt-1'>
                        Cena za kus: {selectedItem.price.toFixed(2)} Kč
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => removeIngredient(index)}
                  className='mt-0'
                >
                  <Trash2 className='h-4 w-4' />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
