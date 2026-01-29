'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getAvailableSourceBoards, performOrderCut } from '@/app/actions/inventory';
import type { MaterialRequirement } from '@/lib/types/order-material';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CutAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirement: MaterialRequirement;
  orderId: number;
  onSuccess: () => void;
}

type SourceBoard = {
  id: string;
  name: string;
  width: number;
  height: number;
  thickness: number;
  price: number;
  itemDefinitionId: number | null;
};

export function CutAllocationDialog({
  open,
  onOpenChange,
  requirement,
  orderId,
  onSuccess,
}: CutAllocationDialogProps) {
  const [boards, setBoards] = useState<SourceBoard[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toast } = useToast();

  const minWidth = requirement.width ?? 0;
  const minHeight = requirement.height ?? 0;
  const hasDimensions = minWidth > 0 && minHeight > 0;

  useEffect(() => {
    if (!open || !hasDimensions) return;

    let cancelled = false;
    setLoading(true);
    setSelectedId(null);

    getAvailableSourceBoards({
      itemDefinitionId: requirement.itemDefinitionId,
      minWidth,
      minHeight,
    })
      .then((result) => {
        if (cancelled) return;
        setLoading(false);
        if (result.success && result.data) {
          setBoards(result.data as SourceBoard[]);
        } else {
          setBoards([]);
          toast({
            title: 'Chyba',
            description: result.error ?? 'Nepodařilo se načíst desky',
            variant: 'destructive',
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setBoards([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, requirement.itemDefinitionId, minWidth, minHeight, hasDimensions, toast]);

  const handleCut = async () => {
    if (!selectedId) return;

    setSubmitting(true);
    const result = await performOrderCut({
      sourceItemId: selectedId,
      targetWidth: minWidth,
      targetHeight: minHeight,
      quantity: 1,
      orderId,
    });
    setSubmitting(false);

    if (result.success) {
      toast({
        title: 'Úspěch',
        description: result.message ?? 'Řez proveden',
      });
      onSuccess();
      onOpenChange(false);
    } else {
      toast({
        title: 'Chyba',
        description: result.error ?? 'Nepodařilo se provést řez',
        variant: 'destructive',
      });
    }
  };

  const summary =
    hasDimensions
      ? `${requirement.definitionName} – ${requirement.quantityRequired} ks, ${minWidth} × ${minHeight} mm`
      : requirement.definitionName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nařezat materiál</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-6 text-sm text-muted-foreground text-center">
            Načítání dostupných desek...
          </div>
        ) : boards.length === 0 ? (
          <div className="py-6 text-sm text-muted-foreground text-center">
            Žádné dostupné desky větší než požadované rozměry.
          </div>
        ) : (
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            <p className="text-sm font-medium">Vyberte zdrojovou desku:</p>
            <ul className="space-y-1">
              {boards.map((board) => (
                <li key={board.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(board.id)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md border text-sm transition-colors',
                      selectedId === board.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <span className="font-medium">{board.name}</span>
                    <span className="text-muted-foreground ml-2">
                      {board.width} × {board.height} mm
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Zrušit
          </Button>
          <Button
            type="button"
            onClick={handleCut}
            disabled={loading || boards.length === 0 || !selectedId || submitting}
          >
            {submitting ? 'Probíhá řez...' : 'Nařezat'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
