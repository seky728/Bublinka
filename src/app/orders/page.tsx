'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getOrders, deleteOrder } from '../actions/orders';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { CreateOrderDialog } from '@/components/orders/create-order-dialog';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { useToast } from '@/hooks/use-toast';

type OrderListItem = {
  id: number;
  formattedId: string;
  name: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: Date;
  updatedAt: Date;
  itemCount: number;
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { toast } = useToast();

  const loadOrders = async () => {
    setLoading(true);
    const result = await getOrders();
    if (result.success && result.data) {
      setOrders(result.data);
    } else {
      toast({
        title: 'Chyba',
        description: result.error || 'Nepodařilo se načíst objednávky',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleCreateSuccess = () => {
    setCreateDialogOpen(false);
    loadOrders();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Opravdu chcete smazat tuto objednávku?')) {
      return;
    }

    setDeletingId(id);
    const result = await deleteOrder({ id });
    setDeletingId(null);

    if (result.success) {
      toast({
        title: 'Úspěch',
        description: result.message || 'Objednávka byla úspěšně smazána',
      });
      loadOrders();
    } else {
      toast({
        title: 'Chyba',
        description: result.error || 'Nepodařilo se smazat objednávku',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className='container mx-auto py-8 px-4'>
      <div className='flex justify-between items-center mb-6'>
        <h1 className='text-3xl font-bold'>Objednávky</h1>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className='h-4 w-4 mr-2' />
          Vytvořit objednávku
        </Button>
      </div>

      {loading ? (
        <div className='text-center py-8'>Načítání...</div>
      ) : orders.length === 0 ? (
        <div className='text-center py-12 border rounded-lg'>
          <p className='text-muted-foreground mb-4'>Žádné objednávky</p>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className='h-4 w-4 mr-2' />
            Vytvořit první objednávku
          </Button>
        </div>
      ) : (
        <div className='border rounded-lg'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Název</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Počet položek</TableHead>
                <TableHead>Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow
                  key={order.id}
                  className='cursor-pointer hover:bg-muted/50'
                  onClick={() => router.push(`/orders/${order.id}`)}
                >
                  <TableCell className='font-medium'>
                    {order.formattedId}
                  </TableCell>
                  <TableCell className='font-medium'>{order.name}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={order.status} />
                  </TableCell>
                  <TableCell>{formatDate(order.createdAt)}</TableCell>
                  <TableCell>{order.itemCount}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant='destructive'
                      size='sm'
                      onClick={() => handleDelete(order.id)}
                      disabled={deletingId === order.id}
                    >
                      <Trash2 className='h-4 w-4 mr-2' />
                      {deletingId === order.id ? 'Mazání...' : 'Smazat'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateOrderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
