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

const statusLabels: Record<string, string> = {
  AVAILABLE: 'Dostupné',
  CONSUMED: 'Spotřebováno',
  REMNANT: 'Zbytek',
};

type InventoryGroup = {
  name: string;
  total: number;
  reserved: number;
  available: number;
  sampleItem: InventoryItem; // For dimensions, price, status display
};

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
      
      // Group items by name and calculate totals
      const grouped = new Map<string, InventoryGroup>();
      
      for (const item of result.data) {
        // Only count AVAILABLE items for totals
        if (item.status === 'AVAILABLE') {
          const existing = grouped.get(item.name);
          if (existing) {
            existing.total += 1;
            existing.reserved += item.reservedQuantity;
          } else {
            grouped.set(item.name, {
              name: item.name,
              total: 1,
              reserved: item.reservedQuantity,
              available: 0, // Will calculate after
              sampleItem: item,
            });
          }
        } else if (!grouped.has(item.name)) {
          // Include sample item even if not available (for dimensions/price display)
          grouped.set(item.name, {
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
                  <TableRow key={group.name}>
                    <TableCell className='font-medium'>{group.name}</TableCell>
                    <TableCell>
                      {group.sampleItem.width} × {group.sampleItem.height} × {group.sampleItem.thickness}
                    </TableCell>
                    <TableCell>{group.sampleItem.price.toFixed(2)}</TableCell>
                    <TableCell className='font-medium'>{group.total}</TableCell>
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
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          group.sampleItem.status === 'AVAILABLE'
                            ? 'bg-green-100 text-green-800'
                            : group.sampleItem.status === 'CONSUMED'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {statusLabels[group.sampleItem.status] || group.sampleItem.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          // Find first available item for cutting
                          const availableItem = items.find(
                            (i) => i.name === group.name && i.status === 'AVAILABLE'
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
