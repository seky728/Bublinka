'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import type { ItemDefinition } from '@prisma/client';

export interface RecipeIngredient {
  itemDefinitionId: number;
  quantity: number;
  width?: number;
  height?: number;
}

export type RecipeIngredientErrors = {
  itemDefinitionId?: string;
  quantity?: string;
  width?: string;
  height?: string;
};

interface RecipeEditorProps {
  ingredients: RecipeIngredient[];
  onChange: (ingredients: RecipeIngredient[]) => void;
  definitions: ItemDefinition[];
  errors?: RecipeIngredientErrors[];
}

function formatIngredientSummary(
  name: string,
  quantity: number,
  width?: number,
  height?: number,
): string {
  if (width != null && height != null && width > 0 && height > 0) {
    return `${name} (${width} × ${height} mm) – ${quantity} ks`;
  }
  return `${name} – ${quantity} ks`;
}

export function RecipeEditor({
  ingredients,
  onChange,
  definitions,
  errors = [],
}: RecipeEditorProps) {
  const addIngredient = () => {
    onChange([
      ...ingredients,
      {
        itemDefinitionId: 0,
        quantity: 1,
        width: undefined,
        height: undefined,
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
    const raw = updated[index];
    if (field === 'itemDefinitionId') {
      const numVal = typeof value === 'number' ? value : parseInt(String(value), 10);
      updated[index] = {
        ...raw,
        itemDefinitionId: numVal,
        width: undefined,
        height: undefined,
      };
    } else if (field === 'quantity' || field === 'width' || field === 'height') {
      const numVal = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
      updated[index] = { ...raw, [field]: numVal };
    } else {
      updated[index] = { ...raw, [field]: value };
    }
    onChange(updated);
  };

  const comboboxOptions: ComboboxOption[] = definitions.map((def) => ({
    value: String(def.id),
    label: def.name,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Ingredience (receptura)</label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addIngredient}
        >
          <Plus className="h-4 w-4 mr-2" />
          Přidat ingredienci
        </Button>
      </div>

      {ingredients.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-4 border rounded-md">
          Žádné ingredience. Klikněte na &quot;Přidat ingredienci&quot; pro
          přidání.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Položka</TableHead>
              <TableHead className="w-[100px]">Šířka (mm)</TableHead>
              <TableHead className="w-[100px]">Výška (mm)</TableHead>
              <TableHead className="w-[90px]">Množství</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingredients.map((ingredient, index) => {
              const itemErrors = errors[index] || {};
              const selectedDef = definitions.find(
                (d) => d.id === ingredient.itemDefinitionId,
              );
              const valueStr =
                ingredient.itemDefinitionId > 0
                  ? String(ingredient.itemDefinitionId)
                  : '';
              const isSheetMaterial = selectedDef?.category === 'SHEET_MATERIAL';

              return (
                <TableRow key={index}>
                  <TableCell className="align-top">
                    <div className="space-y-1">
                      <Combobox
                        options={comboboxOptions}
                        value={valueStr}
                        onValueChange={(value) =>
                          updateIngredient(
                            index,
                            'itemDefinitionId',
                            value ? parseInt(value, 10) : 0,
                          )
                        }
                        placeholder="Vyberte definici položky"
                        searchPlaceholder="Hledat definici..."
                        emptyText="Žádné definice. Přidejte je v Katalogu."
                      />
                      {itemErrors.itemDefinitionId && (
                        <p className="text-sm text-red-500">
                          {itemErrors.itemDefinitionId}
                        </p>
                      )}
                      {selectedDef && (
                        <p className="text-xs text-muted-foreground">
                          {formatIngredientSummary(
                            selectedDef.name,
                            ingredient.quantity,
                            ingredient.width,
                            ingredient.height,
                          )}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    {isSheetMaterial ? (
                      <div className="space-y-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="mm"
                          className="h-9"
                          value={ingredient.width ?? ''}
                          onChange={(e) =>
                            updateIngredient(
                              index,
                              'width',
                              parseFloat(e.target.value) || 0,
                            )
                          }
                        />
                        {itemErrors.width && (
                          <p className="text-sm text-red-500">{itemErrors.width}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {isSheetMaterial ? (
                      <div className="space-y-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="mm"
                          className="h-9"
                          value={ingredient.height ?? ''}
                          onChange={(e) =>
                            updateIngredient(
                              index,
                              'height',
                              parseFloat(e.target.value) || 0,
                            )
                          }
                        />
                        {itemErrors.height && (
                          <p className="text-sm text-red-500">{itemErrors.height}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="space-y-1">
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="ks"
                        className="h-9"
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
                        <p className="text-sm text-red-500">{itemErrors.quantity}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeIngredient(index)}
                      className="h-9 w-9"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
