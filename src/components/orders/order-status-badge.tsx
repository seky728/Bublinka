import { cn } from '@/lib/utils';
import type { OrderStatus } from '@prisma/client';

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

const statusConfig: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  DRAFT: {
    label: 'Návrh',
    className: 'bg-gray-100 text-gray-800',
  },
  IN_PROGRESS: {
    label: 'V práci',
    className: 'bg-blue-100 text-blue-800',
  },
  COMPLETED: {
    label: 'Dokončeno',
    className: 'bg-green-100 text-green-800',
  },
  CANCELLED: {
    label: 'Zrušeno',
    className: 'bg-red-100 text-red-800',
  },
};

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'px-2 py-1 rounded text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
