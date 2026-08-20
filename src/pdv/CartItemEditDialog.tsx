import { useEffect, useState } from 'react';
import { Package, Trash2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/FormField';
import { usePdv, type CartItem } from '@/stores/pdvStore';
import { formatCurrency } from '@/lib/utils';

export function CartItemEditDialog({
  index,
  onClose,
}: {
  index: number;
  onClose: () => void;
}) {
  const item = usePdv((s) => s.items[index]);
  const setQuant = usePdv((s) => s.setQuant);
  const setValor = usePdv((s) => s.setValor);
  const removeItem = usePdv((s) => s.removeItem);

  const [quant, setQuantState] = useState('');
  const [valor, setValorState] = useState('');

  useEffect(() => {
    if (!item) return;
    setQuantState(String(item.quant).replace('.', ','));
    setValorState(item.valor.toFixed(2).replace('.', ','));
  }, [item]);

  if (!item) return null;

  const parsedQuant = parseFloat(quant.replace('.', '').replace(',', '.')) || 0;
  const parsedValor = parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0;
  const total = parsedQuant * parsedValor;

  const save = () => {
    if (parsedQuant <= 0) return;
    setQuant(index, parsedQuant);
    setValor(index, parsedValor);
    onClose();
  };

  const remove = () => {
    removeItem(index);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar item</DialogTitle>
        </DialogHeader>

        <div className="rounded-xl bg-black/30 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{item.nome_produto}</div>
            <div className="text-xs text-muted-foreground">{item.unidade ?? 'UN'}{item.fracionado ? ' · fracionado' : ''}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Quantidade" required>
            <Input
              autoFocus
              value={quant}
              onChange={(e) => setQuantState(e.target.value)}
              inputMode="decimal"
              onFocus={(e) => e.currentTarget.select()}
            />
          </FormField>
          <FormField label="Valor unitário" required>
            <Input
              value={valor}
              onChange={(e) => setValorState(e.target.value)}
              inputMode="decimal"
              onFocus={(e) => e.currentTarget.select()}
            />
          </FormField>
        </div>

        <div className="rounded-xl bg-success/10 border border-success/30 p-3 flex justify-between items-baseline">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Subtotal do item</span>
          <span className="text-2xl font-bold tabular-nums text-success">{formatCurrency(total)}</span>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="destructive" onClick={remove}>
            <Trash2 className="w-4 h-4" /> Remover
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={parsedQuant <= 0}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { CartItem };
