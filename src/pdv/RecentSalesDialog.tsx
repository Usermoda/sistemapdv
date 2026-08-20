import { useEffect, useState } from 'react';
import { Clock, Eye, FileText, Loader2, RefreshCcw, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import { ReceiptPreview, type ReceiptData } from './ReceiptPreview';

type SaleRow = {
  id: number;
  controle: string;
  data_venda: string;
  nome_cliente: string | null;
  vr_total: number;
  vr_dinheiro: number;
  vr_cheque: number;
  vr_cartao: number;
  vr_carne: number;
  vr_ticket: number;
  terminal: string;
  turno: string;
};

export function RecentSalesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ReceiptData | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const rows = (await api.erp.sales.list({ from, to: today, limit: 30 })) as unknown as SaleRow[];
      setSales(rows);
    } catch {
      // silent
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) void load();
  }, [open]);

  const openPreview = async (sale: SaleRow) => {
    const detail = await api.erp.sales.get(sale.id);
    if (!detail) return;
    const company = (await api.pdv.getCompany()) ?? {};
    const nfce = await api.fiscal.getByVenda(sale.id).catch(() => null);
    const payments: Array<{ label: string; valor: number }> = [];
    if (Number(sale.vr_dinheiro) > 0) payments.push({ label: 'Dinheiro', valor: Number(sale.vr_dinheiro) });
    if (Number(sale.vr_cheque) > 0) payments.push({ label: 'Cheque', valor: Number(sale.vr_cheque) });
    if (Number(sale.vr_cartao) > 0) payments.push({ label: 'Cartão', valor: Number(sale.vr_cartao) });
    if (Number(sale.vr_carne) > 0) payments.push({ label: 'Carnê', valor: Number(sale.vr_carne) });
    if (Number(sale.vr_ticket) > 0) payments.push({ label: 'Ticket', valor: Number(sale.vr_ticket) });
    const subtotal = detail.items.reduce((s, i) => s + Number((i as { vr_total: number }).vr_total), 0);
    const total = Number(sale.vr_total);
    const desconto = Math.max(0, subtotal - total);
    const troco = Math.max(0, payments.reduce((s, p) => s + p.valor, 0) - total);
    setPreview({
      company,
      control: sale.controle,
      items: detail.items.map((i) => {
        const it = i as { nome_produto: string; quant: number; valor: number; vr_total: number; unidade: string | null };
        return {
          nome_produto: it.nome_produto,
          quant: Number(it.quant),
          valor: Number(it.valor),
          vr_total: Number(it.vr_total),
          unidade: it.unidade ?? 'UN',
        };
      }),
      payments,
      subtotal,
      desconto,
      total,
      troco,
      cliente: sale.nome_cliente ? { nome: sale.nome_cliente } : undefined,
      nfce: nfce && nfce.status === 'autorizado' && nfce.chave_nfe
        ? {
            chave_nfe: nfce.chave_nfe,
            numero: nfce.numero,
            serie: nfce.serie,
            protocolo: nfce.protocolo,
            qrcode_url: nfce.qrcode_url,
            ambiente: null,
          }
        : null,
    });
  };

  const today = new Date().toISOString().slice(0, 10);
  const dayOf = (v: unknown): string => {
    if (!v) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    try {
      return new Date(v as string | number).toISOString().slice(0, 10);
    } catch {
      return String(v).slice(0, 10);
    }
  };
  const totalHoje = sales.filter((s) => dayOf(s.data_venda) === today).reduce((s, r) => s + Number(r.vr_total), 0);
  const qtdHoje = sales.filter((s) => dayOf(s.data_venda) === today).length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <div>
                <DialogTitle>Últimas vendas</DialogTitle>
                <div className="text-xs text-muted-foreground mt-1">
                  Hoje: {qtdHoje} vendas · {formatCurrency(totalHoje)} — Últimos 7 dias
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={load} disabled={loading}>
                <RefreshCcw className={cn('w-4 h-4', loading && 'animate-spin')} />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-1">
            {loading && sales.length === 0 && (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
            {!loading && sales.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto opacity-30 mb-2" />
                Nenhuma venda registrada
              </div>
            )}
            {sales.map((s) => {
              const d = new Date(s.data_venda);
              const isToday = dayOf(s.data_venda) === today;
              return (
                <button
                  key={s.id}
                  onClick={() => openPreview(s)}
                  className="w-full text-left p-3 rounded-xl bg-card border border-white/5 hover:border-primary/30 transition-colors flex items-center gap-3 touch-target"
                >
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', isToday ? 'bg-primary/10' : 'bg-white/5')}>
                    <Clock className={cn('w-4 h-4', isToday ? 'text-primary' : 'text-muted-foreground')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{s.controle}</span>
                      {isToday && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold">HOJE</span>}
                    </div>
                    <div className="text-sm mt-0.5 flex items-center gap-2">
                      {s.nome_cliente ? (
                        <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {s.nome_cliente}</span>
                      ) : (
                        <span className="text-muted-foreground">Consumidor</span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {d.toLocaleDateString('pt-BR')} · Terminal {s.terminal}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-bold tabular-nums text-success">{formatCurrency(Number(s.vr_total))}</div>
                    <div className="text-[10px] text-primary flex items-center gap-1 justify-end mt-0.5">
                      <Eye className="w-3 h-3" /> Ver nota
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {preview && <ReceiptPreview data={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
