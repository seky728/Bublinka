'use client';

import { useEffect, useState } from 'react';
import {
  getAllItemDefinitions,
  deleteItemDefinition,
} from '@/app/actions/item-definitions';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { DefinitionDialog } from '@/components/settings/definition-dialog';
import { useToast } from '@/hooks/use-toast';
import type { ItemDefinition } from '@prisma/client';

const CATEGORY_LABELS: Record<string, string> = {
  SHEET_MATERIAL: 'Deskový materiál',
  COMPONENT: 'Komponent',
  OTHER: 'Ostatní',
};

export default function CatalogPage() {
  const [definitions, setDefinitions] = useState<ItemDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingDefinition, setEditingDefinition] =
    useState<ItemDefinition | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { toast } = useToast();

  const loadDefinitions = async () => {
    setLoading(true);
    const result = await getAllItemDefinitions();
    if (result.success && result.data) {
      setDefinitions(result.data);
    } else {
      toast({
        title: 'Chyba',
        description: result.error || 'Nepodařilo se načíst definice položek',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDefinitions();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Opravdu chcete smazat tuto definici?')) {
      return;
    }

    setDeletingId(id);
    const result = await deleteItemDefinition({ id });
    setDeletingId(null);

    if (result.success) {
      toast({
        title: 'Úspěch',
        description: result.message || 'Definice byla úspěšně smazána',
      });
      loadDefinitions();
    } else {
      toast({
        title: 'Chyba',
        description: result.error || 'Nepodařilo se smazat definici',
        variant: 'destructive',
      });
    }
  };

  const truncate = (text: string | null | undefined, maxLen: number) => {
    if (!text) return '—';
    return text.length <= maxLen ? text : `${text.slice(0, maxLen)}…`;
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Katalog položek</h1>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Přidat definici
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">Načítání...</div>
      ) : definitions.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground mb-4">Žádné definice</p>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Přidat první definici
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Název</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Popis</TableHead>
                <TableHead>Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {definitions.map((def) => (
                <TableRow key={def.id}>
                  <TableCell className="font-medium">{def.name}</TableCell>
                  <TableCell>
                    {CATEGORY_LABELS[def.category] ?? def.category}
                  </TableCell>
                  <TableCell className="max-w-[200px] text-muted-foreground">
                    {truncate(def.description, 50)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingDefinition(def)}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Upravit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(def.id)}
                        disabled={deletingId === def.id}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {deletingId === def.id ? 'Mazání...' : 'Smazat'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DefinitionDialog
        open={createDialogOpen || editingDefinition !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditingDefinition(null);
          }
        }}
        onSuccess={() => {
          setCreateDialogOpen(false);
          setEditingDefinition(null);
          loadDefinitions();
          toast({
            title: 'Úspěch',
            description:
              editingDefinition != null
                ? 'Definice byla úspěšně aktualizována'
                : 'Definice byla úspěšně vytvořena',
          });
        }}
        initialData={editingDefinition ?? undefined}
      />
    </div>
  );
}
