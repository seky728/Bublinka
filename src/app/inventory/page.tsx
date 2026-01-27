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

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
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
                <TableHead>Status</TableHead>
                <TableHead>Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className='text-center py-8 text-muted-foreground'
                  >
                    Žádné položky
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className='font-medium'>{item.name}</TableCell>
                    <TableCell>
                      {item.width} × {item.height} × {item.thickness}
                    </TableCell>
                    <TableCell>{item.price.toFixed(2)}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          item.status === 'AVAILABLE'
                            ? 'bg-green-100 text-green-800'
                            : item.status === 'CONSUMED'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {statusLabels[item.status] || item.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleCutClick(item)}
                        disabled={item.status !== 'AVAILABLE'}
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
