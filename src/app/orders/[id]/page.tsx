'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  getOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  addOrderItem,
  removeOrderItem,
} from '@/app/actions/orders';
import { getProducts } from '@/app/actions/products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Trash2, Plus, X, Play, Check, RotateCcw, Ban, AlertCircle } from 'lucide-react';
import type { Order, OrderItem, Product, OrderStatus } from '@prisma/client';

type OrderWithItems = Order & {
  formattedId: string;
  items: Array<
    OrderItem & {
      product: Pick<Product, 'id' | 'name' | 'sellingPrice' | 'photoUrl'>;
    }
  >;
};

type ProductOption = Pick<Product, 'id' | 'name'>;

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = parseInt(params.id as string);
  const { toast } = useToast();

  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [addingItem, setAddingItem] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [orderName, setOrderName] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showLockAlert, setShowLockAlert] = useState(false);

  const loadOrder = async () => {
    if (isNaN(orderId)) {
      toast({
        title: 'Chyba',
        description: 'Neplatné ID objednávky',
        variant: 'destructive',
      });
      router.push('/orders');
      return;
    }

    setLoading(true);
    const result = await getOrder({ id: orderId });
    setLoading(false);

    if (result.success && result.data) {
      setOrder(result.data);
      setOrderName(result.data.name);
    } else {
      toast({
        title: 'Chyba',
        description: result.error || 'Nepodařilo se načíst objednávku',
        variant: 'destructive',
      });
      router.push('/orders');
    }
  };

  const loadProducts = async () => {
    const result = await getProducts();
    if (result.success && result.data) {
      setProducts(
        result.data.map((p) => ({
          id: p.id,
          name: p.name,
        }))
      );
    }
  };

  useEffect(() => {
    loadOrder();
    loadProducts();
  }, [orderId]);

  const handleNameUpdate = async (newName: string) => {
    if (!order || newName === order.name || !newName.trim()) {
      setOrderName(order?.name || '');
      setEditingName(false);
      return;
    }

    // Check if order is locked (not in DRAFT)
    if (order.status !== 'DRAFT') {
      setOrderName(order.name);
      setEditingName(false);
      setShowLockAlert(true);
      setTimeout(() => setShowLockAlert(false), 3000);
      return;
    }

    setUpdating(true);
    const result = await updateOrder({ id: orderId, name: newName });
    setUpdating(false);

    if (result.success && result.data) {
      setOrder(result.data);
      setOrderName(result.data.name);
      toast({
        title: 'Úspěch',
        description: 'Název objednávky byl aktualizován',
      });
    } else {
      toast({
        title: 'Chyba',
        description: result.error || 'Nepodařilo se aktualizovat název',
        variant: 'destructive',
      });
      setOrderName(order.name);
    }
    setEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setOrderName(order?.name || '');
      setEditingName(false);
    }
  };

  const handleStatusChange = async (newStatus: OrderStatus) => {
    setUpdatingStatus(true);
    const result = await updateOrderStatus({ id: orderId, status: newStatus });
    setUpdatingStatus(false);

    if (result.success && result.data) {
      setOrder(result.data);
      toast({
        title: 'Úspěch',
        description: result.message || 'Status objednávky byl aktualizován',
      });
    } else {
      toast({
        title: 'Chyba',
        description: result.error || 'Nepodařilo se změnit status',
        variant: 'destructive',
      });
    }
  };

  const isLocked = order?.status !== 'DRAFT';

  const handleDelete = async () => {
    if (!confirm('Opravdu chcete smazat tuto objednávku?')) {
      return;
    }

    setUpdating(true);
    const result = await deleteOrder({ id: orderId });
    setUpdating(false);

    if (result.success) {
      toast({
        title: 'Úspěch',
        description: result.message || 'Objednávka byla úspěšně smazána',
      });
      router.push('/orders');
    } else {
      toast({
        title: 'Chyba',
        description: result.error || 'Nepodařilo se smazat objednávku',
        variant: 'destructive',
      });
    }
  };

  const handleAddItem = async () => {
    if (!selectedProductId || !quantity) {
      toast({
        title: 'Chyba',
        description: 'Vyberte produkt a zadejte množství',
        variant: 'destructive',
      });
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: 'Chyba',
        description: 'Množství musí být kladné celé číslo',
        variant: 'destructive',
      });
      return;
    }

    // Check if product already in order
    if (order?.items.some((item) => item.productId === selectedProductId)) {
      toast({
        title: 'Chyba',
        description: 'Produkt již je v objednávce',
        variant: 'destructive',
      });
      return;
    }

    setAddingItem(true);
    const result = await addOrderItem({
      orderId,
      productId: selectedProductId,
      quantity: qty,
    });
    setAddingItem(false);

    if (result.success) {
      setSelectedProductId('');
      setQuantity('1');
      loadOrder();
      toast({
        title: 'Úspěch',
        description: result.message || 'Produkt byl přidán do objednávky',
      });
    } else {
      toast({
        title: 'Chyba',
        description: result.error || 'Nepodařilo se přidat produkt',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveItem = async (itemId: number) => {
    setRemovingItemId(itemId);
    const result = await removeOrderItem({ itemId });
    setRemovingItemId(null);

    if (result.success) {
      loadOrder();
      toast({
        title: 'Úspěch',
        description: result.message || 'Produkt byl odebrán z objednávky',
      });
    } else {
      toast({
        title: 'Chyba',
        description: result.error || 'Nepodařilo se odebrat produkt',
        variant: 'destructive',
      });
    }
  };

  // Filter out products already in order
  const availableProducts: ComboboxOption[] = products
    .filter((p) => !order?.items.some((item) => item.productId === p.id))
    .map((p) => ({
      value: p.id,
      label: p.name,
    }));

  if (loading) {
    return (
      <div className='container mx-auto py-8 px-4'>
        <div className='text-center py-8'>Načítání...</div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  // Get available status actions based on current status
  const getStatusActions = () => {
    if (!order) return [];

    const actions: Array<{
      label: string;
      status: OrderStatus;
      icon: React.ReactNode;
      variant: 'default' | 'secondary' | 'outline';
    }> = [];

    switch (order.status) {
      case 'DRAFT':
        actions.push({
          label: 'Zahájit výrobu',
          status: 'IN_PROGRESS',
          icon: <Play className='h-4 w-4 mr-2' />,
          variant: 'default',
        });
        actions.push({
          label: 'Zrušit',
          status: 'CANCELLED',
          icon: <Ban className='h-4 w-4 mr-2' />,
          variant: 'outline',
        });
        break;
      case 'IN_PROGRESS':
        actions.push({
          label: 'Dokončit',
          status: 'COMPLETED',
          icon: <Check className='h-4 w-4 mr-2' />,
          variant: 'default',
        });
        actions.push({
          label: 'Vrátit do návrhu',
          status: 'DRAFT',
          icon: <RotateCcw className='h-4 w-4 mr-2' />,
          variant: 'secondary',
        });
        actions.push({
          label: 'Zrušit',
          status: 'CANCELLED',
          icon: <Ban className='h-4 w-4 mr-2' />,
          variant: 'outline',
        });
        break;
      case 'COMPLETED':
        actions.push({
          label: 'Vrátit do výroby',
          status: 'IN_PROGRESS',
          icon: <RotateCcw className='h-4 w-4 mr-2' />,
          variant: 'secondary',
        });
        actions.push({
          label: 'Zrušit',
          status: 'CANCELLED',
          icon: <Ban className='h-4 w-4 mr-2' />,
          variant: 'outline',
        });
        break;
      case 'CANCELLED':
        actions.push({
          label: 'Obnovit zakázku',
          status: 'DRAFT',
          icon: <RotateCcw className='h-4 w-4 mr-2' />,
          variant: 'default',
        });
        break;
    }

    return actions;
  };

  return (
    <div className='container mx-auto py-8 px-4'>
      {/* Lock Alert Banner */}
      {showLockAlert && (
        <div className='mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-yellow-800'>
          <AlertCircle className='h-4 w-4' />
          <span className='text-sm'>
            Objednávka je v procesu. Vraťte ji do návrhu pro úpravy.
          </span>
        </div>
      )}

      {/* Header */}
      <div className='flex items-center gap-4 mb-6'>
        <Button
          variant='ghost'
          size='icon'
          onClick={() => router.push('/orders')}
        >
          <ArrowLeft className='h-4 w-4' />
        </Button>
        <div className='flex-1'>
          {editingName && !isLocked ? (
            <Input
              value={orderName}
              onChange={(e) => setOrderName(e.target.value)}
              onBlur={() => handleNameUpdate(orderName)}
              onKeyDown={handleNameKeyDown}
              className='text-2xl font-bold h-auto py-2'
              autoFocus
            />
          ) : (
            <h1
              className={`text-3xl font-bold ${
                isLocked
                  ? 'cursor-not-allowed text-muted-foreground'
                  : 'cursor-pointer hover:text-muted-foreground transition-colors'
              }`}
              onClick={() => {
                if (!isLocked) {
                  setEditingName(true);
                } else {
                  setShowLockAlert(true);
                  setTimeout(() => setShowLockAlert(false), 3000);
                }
              }}
            >
              {order.name}
            </h1>
          )}
          <div className='flex items-center gap-3 mt-2'>
            <span className='text-muted-foreground'>{order.formattedId}</span>
            <OrderStatusBadge status={order.status} />
          </div>
        </div>
        <div className='flex items-center gap-2'>
          {/* Status Action Buttons */}
          {getStatusActions().map((action) => (
            <Button
              key={action.status}
              variant={action.variant}
              onClick={() => handleStatusChange(action.status)}
              disabled={updatingStatus}
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
          <Button
            variant='destructive'
            onClick={handleDelete}
            disabled={updating}
          >
            <Trash2 className='h-4 w-4 mr-2' />
            Smazat
          </Button>
        </div>
      </div>

      {/* Add Product Section - Only shown when in DRAFT */}
      {!isLocked && (
        <div className='border rounded-lg p-4 mb-6'>
          <h2 className='text-lg font-semibold mb-4'>Přidat produkt</h2>
          <div className='flex gap-4'>
            <div className='flex-1'>
              <Combobox
                options={availableProducts}
                value={selectedProductId}
                onValueChange={setSelectedProductId}
                placeholder='Vyberte produkt...'
                emptyText='Žádné dostupné produkty'
              />
            </div>
            <div className='w-32'>
              <Input
                type='number'
                min='1'
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder='Množství'
              />
            </div>
            <Button
              onClick={handleAddItem}
              disabled={addingItem || !selectedProductId || !quantity}
            >
              {addingItem ? (
                'Přidávání...'
              ) : (
                <>
                  <Plus className='h-4 w-4 mr-2' />
                  Přidat
                </>
              )}
            </Button>
          </div>
          {availableProducts.length === 0 && products.length > 0 && (
            <p className='text-sm text-muted-foreground mt-2'>
              Všechny produkty jsou již v objednávce
            </p>
          )}
        </div>
      )}

      {/* Status-specific Info Banners */}
      {order.status === 'CANCELLED' && (
        <div className='mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between'>
          <div className='flex items-center gap-2 text-red-800'>
            <AlertCircle className='h-4 w-4' />
            <span className='text-sm font-medium'>Zakázka je zrušena</span>
          </div>
          <Button
            variant='default'
            size='sm'
            onClick={() => handleStatusChange('DRAFT')}
            disabled={updatingStatus}
          >
            <RotateCcw className='h-4 w-4 mr-2' />
            Obnovit do návrhu
          </Button>
        </div>
      )}

      {order.status === 'COMPLETED' && (
        <div className='mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between'>
          <div className='flex items-center gap-2 text-green-800'>
            <Check className='h-4 w-4' />
            <span className='text-sm font-medium'>Zakázka je hotová</span>
          </div>
          <Button
            variant='secondary'
            size='sm'
            onClick={() => handleStatusChange('IN_PROGRESS')}
            disabled={updatingStatus}
          >
            <RotateCcw className='h-4 w-4 mr-2' />
            Vrátit do výroby
          </Button>
        </div>
      )}

      {/* Lock Info Banner - Shown when order is in progress */}
      {order.status === 'IN_PROGRESS' && (
        <div className='mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-blue-800'>
          <AlertCircle className='h-4 w-4' />
          <span className='text-sm'>
            Objednávka je v procesu. Vraťte ji do návrhu pro úpravy.
          </span>
        </div>
      )}

      {/* Items Table */}
      <div className='border rounded-lg'>
        <h2 className='text-lg font-semibold p-4 border-b'>Položky objednávky</h2>
        {order.items.length === 0 ? (
          <div className='text-center py-12 text-muted-foreground'>
            Žádné položky v objednávce
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produkt</TableHead>
                <TableHead>Množství</TableHead>
                <TableHead>Jednotková cena</TableHead>
                <TableHead>Celkem</TableHead>
                <TableHead className='w-[100px]'>Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className='font-medium'>
                    {item.product.name}
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{item.unitPrice.toFixed(2)} Kč</TableCell>
                  <TableCell>
                    {(item.quantity * item.unitPrice).toFixed(2)} Kč
                  </TableCell>
                  <TableCell>
                    {!isLocked ? (
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={removingItemId === item.id}
                      >
                        {removingItemId === item.id ? (
                          '...'
                        ) : (
                          <X className='h-4 w-4' />
                        )}
                      </Button>
                    ) : (
                      <span className='text-muted-foreground text-sm'>—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
