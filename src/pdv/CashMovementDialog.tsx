import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/FormField';
import { Numpad, parseMoney } from '@/components/Numpad';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/stores/authStore';
import { cn, formatCurrency } from '@/lib/utils';

export function CashMovementDialog({
  open,
  cashierId,
  onOpenChange,
  initialTipo = 'S',
}: {
  open: boolean;
  cashierId: number;
  onOpenChange: (o: boolean) => void;
  initialTipo?: 'S' | 'A';
}) {
  const [tipo, setTipo] = useState<'S' | 'A'>(initialTipo);
  const [raw, setRaw] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const session = useAuth((s) => s.session);

  const handleSave = async () => {
    const valor = parseMoney(raw);
    if (valor <= 0) return toast.error('Informe um valor válido');
    setSaving(true);
    try {
      await api.pdv.cashMovement({
        id_caixa: cashierId,
        tipo,
        valor,
        descricao: desc || undefined,
        id_login: session?.id,
      });
      toast.success(tipo === 'S' ? `Sangria de ${formatCurrency(valor)} registrada` : `Suprimento de ${formatCurrency(valor)} registrado`);
      setRaw('');
      setDesc('');
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Movimento de caixa</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTipo('S')}
            className={cn(
              'p-4 rounded-xl border-2 transition flex flex-col items-center gap-1',
              tipo === 'S' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-white/5 hover:border-white/20'
            )}
          >
            <ArrowUpRight className="w-6 h-6" />
            <div className="font-semibold">Sangria</div>
            <div className="text-xs text-muted-foreground">Retirada de dinheiro</div>
          </button>
          <button
            onClick={() => setTipo('A')}
            className={cn(
              'p-4 rounded-xl border-2 transition flex flex-col items-center gap-1',
              tipo === 'A' ? 'border-success bg-success/10 text-success' : 'border-white/5 hover:border-white/20'
            )}
          >
            <ArrowDownLeft className="w-6 h-6" />
            <div className="font-semibold">Suprimento</div>
            <div className="text-xs text-muted-foreground">Aporte de dinheiro</div>
          </button>
        </div>

        <div className="rounded-xl bg-black/30 p-4 text-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Valor</div>
          <div className={cn('text-4xl font-bold tabular-nums', tipo === 'S' ? 'text-destructive' : 'text-success')}>
            R$ {raw || '0,00'}
          </div>
        </div>

        <Numpad value={raw} onChange={setRaw} compact />

        <FormField label="Descrição">
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: Troco / pagamento fornecedor" />
        </FormField>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button variant={tipo === 'S' ? 'destructive' : 'success'} onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
