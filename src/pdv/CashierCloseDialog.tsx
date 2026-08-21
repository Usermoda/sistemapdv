import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Wallet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { usePdv } from '@/stores/pdvStore';
import { formatCurrency } from '@/lib/utils';

type Summary = {
  caixa: { id: number; data_abertura: string; hora_abertura: string; vr_abertura: number; terminal: string };
  stats: { pedidos: number; total: number; dinheiro: number; cheque: number; cartao: number; carne: number; ticket: number };
  sangrias: number;
  suprimentos: number;
};

export function CashierCloseDialog({ open, cashierId, onOpenChange, onClosed }: { open: boolean; cashierId: number; onOpenChange: (o: boolean) => void; onClosed: () => void }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [contado, setContado] = useState('');
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const setCashierId = usePdv((s) => s.setCashierId);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.pdv
      .cashierSummary(cashierId)
      .then((s) => setSummary(s as Summary | null))
      .finally(() => setLoading(false));
  }, [open, cashierId]);

  const esperadoDinheiro = summary
    ? Number(summary.caixa.vr_abertura) + Number(summary.stats.dinheiro) + Number(summary.suprimentos ?? 0) - Number(summary.sangrias ?? 0)
    : 0;
  const contadoNum = parseFloat(contado.replace(/\./g, '').replace(',', '.')) || 0;
  const diff = contadoNum - esperadoDinheiro;

  const handleClose = async () => {
    setClosing(true);
    try {
      await api.pdv.closeCashier({ id: cashierId, vr_fechamento: contadoNum });
      toast.success('Caixa fechado');
      setCashierId(null);
      onClosed();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setClosing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-xl bg-warning/10 flex items-center justify-center mb-2">
            <Wallet className="w-7 h-7 text-warning" />
          </div>
          <DialogTitle className="text-center">Fechamento de Caixa</DialogTitle>
        </DialogHeader>

        {loading || !summary ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="rounded-xl bg-black/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Abertura</span><span>{summary.caixa.hora_abertura} · {formatCurrency(Number(summary.caixa.vr_abertura))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pedidos</span><span>{summary.stats.pedidos}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total de vendas</span><span className="font-semibold">{formatCurrency(Number(summary.stats.total))}</span></div>
              <div className="pt-2 border-t border-white/5 space-y-1">
                {Number(summary.stats.dinheiro) > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Dinheiro</span><span>{formatCurrency(Number(summary.stats.dinheiro))}</span></div>}
                {Number(summary.stats.cartao) > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Cartão</span><span>{formatCurrency(Number(summary.stats.cartao))}</span></div>}
                {Number(summary.stats.cheque) > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Cheque</span><span>{formatCurrency(Number(summary.stats.cheque))}</span></div>}
                {Number(summary.stats.carne) > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Carnê</span><span>{formatCurrency(Number(summary.stats.carne))}</span></div>}
                {Number(summary.stats.ticket) > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Ticket</span><span>{formatCurrency(Number(summary.stats.ticket))}</span></div>}
              </div>
              {(Number(summary.suprimentos ?? 0) > 0 || Number(summary.sangrias ?? 0) > 0) && (
                <div className="pt-2 border-t border-white/5 space-y-1">
                  {Number(summary.suprimentos ?? 0) > 0 && <div className="flex justify-between text-xs text-success"><span>+ Suprimentos</span><span>{formatCurrency(Number(summary.suprimentos))}</span></div>}
                  {Number(summary.sangrias ?? 0) > 0 && <div className="flex justify-between text-xs text-destructive"><span>- Sangrias</span><span>{formatCurrency(Number(summary.sangrias))}</span></div>}
                </div>
              )}
            </div>

            <div className="rounded-xl bg-primary/10 border border-primary/30 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Dinheiro em caixa (esperado)</div>
              <div className="text-2xl font-bold tabular-nums text-primary">{formatCurrency(esperadoDinheiro)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Fundo + vendas em dinheiro</div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Valor contado (fechamento)</label>
              <Input value={contado} onChange={(e) => setContado(e.target.value)} placeholder="0,00" className="text-2xl h-14 tabular-nums font-bold text-right" />
              {contado && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`flex items-center gap-2 text-sm ${Math.abs(diff) < 0.01 ? 'text-success' : diff > 0 ? 'text-warning' : 'text-destructive'}`}>
                  {Math.abs(diff) < 0.01 ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {Math.abs(diff) < 0.01 ? 'Conferido' : diff > 0 ? `Sobra: ${formatCurrency(diff)}` : `Falta: ${formatCurrency(Math.abs(diff))}`}
                </motion.div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)} disabled={closing}>
                Cancelar
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleClose} disabled={closing || !contado}>
                {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Fechar caixa
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
