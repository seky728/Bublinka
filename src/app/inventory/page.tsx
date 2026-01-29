'use client';

import { useEffect, useState } from 'react';
import { getInventoryItems } from '../actions/inventory';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { AddItemDialog } from '@/components/inventory/add-item-dialog';
import { CutItemDialog } from '@/components/inventory/cut-item-dialog';
import { useToast } from '@/hooks/use-toast';
import type { InventoryItem } from '@prisma/client';

/** Status badge label and style from group totals (not just DB status) */
function getInventoryStatusDisplay(group: InventoryGroup): { label: string; className: string } {
  const { total: quantity, reserved: reservedQuantity, available: availableCount, sampleItem } = group;
  if (sampleItem.status === 'CONSUMED') {
    return { label: 'Spotřebováno', className: 'bg-gray-100 text-gray-800' };
  }
  // AVAILABLE (and REMNANT): derive label from quantity vs reserved
  if (availableCount <= 0 && quantity > 0) {
    return { label: 'Rezervováno', className: 'bg-amber-100 text-amber-800' };
  }
  if (availableCount > 0 && reservedQuantity > 0) {
    return { label: 'Částečně rezervováno', className: 'bg-blue-100 text-blue-800' };
  }
  if (reservedQuantity === 0) {
    return { label: 'Dostupné', className: 'bg-green-100 text-green-800' };
  }
  return { label: 'Zbytek', className: 'bg-yellow-100 text-yellow-800' };
}

type InventoryGroup = {
  groupKey: string;
  name: string;
  total: number;
  reserved: number;
  available: number;
  sampleItem: InventoryItem; // For dimensions, price, status display
};

/** Unique key for grouping: same definition + dimensions = same row */
function getGroupKey(item: InventoryItem): string {
  const def = item.itemDefinitionId ?? item.name;
  return `${def}-${item.width}-${item.height}-${item.thickness}`;
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [groups, setGroups] = useState<InventoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [cutDialogOpen, setCutDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const { toast } = useToast();

  const loadItems = async () => {
    setLoading(true);
    const result = await getInventoryItems();
    if (result.success && result.data) {
      setItems(result.data);
      
      // Group items by itemDefinitionId + width + height + thickness (strict dimension separation)
      const grouped = new Map<string, InventoryGroup>();

      for (const item of result.data) {
        const key = getGroupKey(item);
        if (item.status === 'AVAILABLE') {
          const existing = grouped.get(key);
          if (existing) {
            existing.total += 1;
            existing.reserved += item.reservedQuantity;
          } else {
            grouped.set(key, {
              groupKey: key,
              name: item.name,
              total: 1,
              reserved: item.reservedQuantity,
              available: 0, // Will calculate after
              sampleItem: item,
            });
          }
        } else if (!grouped.has(key)) {
          grouped.set(key, {
            groupKey: key,
            name: item.name,
            total: 0,
            reserved: 0,
            available: 0,
            sampleItem: item,
          });
        }
      }
      
      // Calculate available for each group
      for (const group of grouped.values()) {
        group.available = group.total - group.reserved;
      }
      
      setGroups(Array.from(grouped.values()));
    } else {
      toast({
        title: 'Chyba',
        description: result.error || 'Nepodařilo se načíst položky',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleAddSuccess = () => {
    setAddDialogOpen(false);
    loadItems();
    toast({
      title: 'Úspěch',
      description: 'Položka byla přidána',
    });
  };

  const handleCutSuccess = () => {
    setCutDialogOpen(false);
    setSelectedItem(null);
    loadItems();
    toast({
      title: 'Úspěch',
      description: 'Řezání bylo dokončeno',
    });
  };

  const handleCutClick = (item: InventoryItem) => {
    if (item.status !== 'AVAILABLE') {
      toast({
        title: 'Chyba',
        description: 'Pouze dostupné položky lze řezat',
        variant: 'destructive',
      });
      return;
    }
    setSelectedItem(item);
    setCutDialogOpen(true);
  };

  return (
    <div className='container mx-auto py-8 px-4'>
      <div className='flex justify-between items-center mb-6'>
        <h1 className='text-3xl font-bold'>Sklad</h1>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className='h-4 w-4 mr-2' />
          Přidat materiál
        </Button>
      </div>

      {loading ? (
        <div className='text-center py-8'>Načítání...</div>
      ) : (
        <div className='border rounded-lg'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Název</TableHead>
                <TableHead>Rozměry (mm)</TableHead>
                <TableHead>Cena (Kč)</TableHead>
                <TableHead>Celkem</TableHead>
                <TableHead>Rezervováno</TableHead>
                <TableHead>Dostupné</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className='text-center py-8 text-muted-foreground'
                  >
                    Žádné položky
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => (
                  <TableRow key={group.groupKey}>
                    <TableCell className='font-medium'>{group.name}</TableCell>
                    <TableCell>
                      {group.sampleItem.width} × {group.sampleItem.height} × {group.sampleItem.thickness}
                    </TableCell>
                    <TableCell>{group.sampleItem.price.toFixed(2)}</TableCell>
                    <TableCell className='font-medium'>{group.total} ks</TableCell>
                    <TableCell>
                      <span
                        className={`font-medium ${
                          group.reserved > 0
                            ? 'text-orange-600'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {group.reserved.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell className='font-medium'>{group.available.toFixed(1)}</TableCell>
                    <TableCell>
                      {(() => {
                        const { label, className } = getInventoryStatusDisplay(group);
                        return (
                          <span className={`px-2 py-1 rounded text-xs ${className}`}>
                            {label}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          // Find first available item in this dimension group
                          const availableItem = items.find(
                            (i) => getGroupKey(i) === group.groupKey && i.status === 'AVAILABLE'
                          );
                          if (availableItem) {
                            handleCutClick(availableItem);
                          }
                        }}
                        disabled={group.available <= 0}
                      >
                        Řezat
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <AddItemDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={handleAddSuccess}
      />

      {selectedItem && (
        <CutItemDialog
          open={cutDialogOpen}
          onOpenChange={setCutDialogOpen}
          item={selectedItem}
          onSuccess={handleCutSuccess}
        />
      )}
    </div>
  );
}
