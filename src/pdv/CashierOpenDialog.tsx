import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Numpad, parseMoney } from '@/components/Numpad';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { usePdv } from '@/stores/pdvStore';
import { useAuth } from '@/stores/authStore';

export function CashierOpenDialog({ open, onOpened }: { open: boolean; onOpened: (id: number) => void }) {
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const setCashierId = usePdv((s) => s.setCashierId);
  const session = useAuth((s) => s.session);

  const handleOpen = async () => {
    const vr = parseMoney(raw);
    setLoading(true);
    try {
      const r = await api.pdv.openCashier({ vr_abertura: vr, id_login: session?.id ?? 1 });
      setCashierId(r.id);
      toast.success('Caixa aberto');
      onOpened(r.id);
    } catch (e) {
      toast.error(`Erro ao abrir caixa: ${(e as Error).message}`);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open}>
      <DialogContent hideClose>
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
            <Wallet className="w-7 h-7 text-primary" />
          </div>
          <DialogTitle className="text-center">Abertura de Caixa</DialogTitle>
          <DialogDescription className="text-center">
            Informe o valor de fundo (troco inicial) para iniciar as vendas.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl bg-black/30 p-6 text-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Fundo de caixa</div>
          <div className="text-4xl font-bold tabular-nums">R$ {raw || '0,00'}</div>
        </div>

        <Numpad value={raw} onChange={setRaw} onEnter={handleOpen} />

        <Button variant="ghost" size="sm" disabled={loading} onClick={handleOpen}>
          {loading ? 'Abrindo...' : 'Confirmar sem numpad'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
