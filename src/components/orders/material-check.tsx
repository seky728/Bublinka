'use client';

import { useEffect, useState } from 'react';
import { getOrderMaterialAvailability } from '@/app/actions/orders';
import type { MaterialRequirement, MaterialAvailabilityStatus } from '@/lib/types/order-material';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CutAllocationDialog } from './cut-allocation-dialog';

interface MaterialCheckProps {
  orderId: number;
  onResolved?: () => void;
}

const statusConfig: Record<
  MaterialAvailabilityStatus,
  { label: string; className: string }
> = {
  ready: {
    label: 'Připraveno',
    className: 'bg-green-100 text-green-800',
  },
  cut_needed: {
    label: 'Potřeba řez',
    className: 'bg-orange-100 text-orange-800',
  },
  missing: {
    label: 'Chybí',
    className: 'bg-red-100 text-red-800',
  },
};

function formatRequirement(req: MaterialRequirement): string {
  const qty = `${req.quantityRequired} ks`;
  if (req.width != null && req.height != null && req.width > 0 && req.height > 0) {
    return `${qty}, ${req.width} × ${req.height} mm`;
  }
  return qty;
}

function StatusBadge({ status }: { status: MaterialAvailabilityStatus }) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        'px-2 py-1 rounded text-xs font-medium shrink-0',
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

export function MaterialCheck({ orderId, onResolved }: MaterialCheckProps) {
  const [requirements, setRequirements] = useState<MaterialRequirement[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [cutDialogRequirement, setCutDialogRequirement] = useState<MaterialRequirement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const result = await getOrderMaterialAvailability({ id: orderId });
      if (cancelled) return;
      setLoading(false);
      if (result.success && result.data != null) {
        setRequirements(result.data);
      } else {
        setError(result.error ?? 'Nepodařilo se načíst dostupnost materiálu');
        setRequirements([]);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orderId, refreshCounter]);

  const handleCutSuccess = () => {
    onResolved?.();
    setRefreshCounter((c) => c + 1);
  };

  const isCutEligible = (req: MaterialRequirement) =>
    req.status === 'cut_needed' &&
    req.width != null &&
    req.height != null &&
    req.width > 0 &&
    req.height > 0;

  if (loading) {
    return (
      <div className="border rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4">Kontrola dostupnosti materiálu</h2>
        <div className="text-sm text-muted-foreground">Načítání...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4">Kontrola dostupnosti materiálu</h2>
        <div className="text-sm text-red-600">{error}</div>
      </div>
    );
  }

  if (requirements == null || requirements.length === 0) {
    return (
      <div className="border rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4">Kontrola dostupnosti materiálu</h2>
        <p className="text-sm text-muted-foreground">
          Žádné materiálové požadavky. Přidejte položky do objednávky.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 mb-6">
      <h2 className="text-lg font-semibold mb-4">Kontrola dostupnosti materiálu</h2>
      <ul className="space-y-3">
        {requirements.map((req, index) => (
          <li
            key={`${req.itemDefinitionId}_${req.width ?? ''}_${req.height ?? ''}_${index}`}
            className="flex flex-wrap items-center gap-3 py-2 border-b last:border-b-0"
          >
            <span className="font-medium">{req.definitionName}</span>
            <span className="text-sm text-muted-foreground">
              {formatRequirement(req)}
            </span>
            <StatusBadge status={req.status} />
            {isCutEligible(req) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCutDialogRequirement(req)}
              >
                Vyřešit
              </Button>
            )}
          </li>
        ))}
      </ul>

      {cutDialogRequirement != null && (
        <CutAllocationDialog
          open={cutDialogRequirement != null}
          onOpenChange={(open) => !open && setCutDialogRequirement(null)}
          requirement={cutDialogRequirement}
          orderId={orderId}
          onSuccess={handleCutSuccess}
        />
      )}
    </div>
  );
}
