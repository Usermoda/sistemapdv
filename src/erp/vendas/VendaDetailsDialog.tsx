import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertCircle, Ban, CheckCircle2, Clock, Eye, ExternalLink, FileCheck2, Loader2, Printer, RefreshCcw, Send, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/FormField';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ReceiptPreview, type ReceiptData } from '@/pdv/ReceiptPreview';

type Detail = {
  header: {
    id: number;
    controle: string;
    data_venda: string;
    nome_cliente: string | null;
    cpf_cnpj: string | null;
    vr_total: number;
    vr_dinheiro: number;
    vr_cheque: number;
    vr_cartao: number;
    vr_carne: number;
    vr_ticket: number;
    vr_adicional: number;
    terminal: string;
    turno: string;
  };
  items: Array<{
    id: number;
    nome_produto: string;
    quant: number;
    valor: number;
    vr_total: number;
    unidade: string | null;
  }>;
};

type NFCe = {
  id: number;
  status: string;
  chave_nfe: string | null;
  numero: number | null;
  serie: number | null;
  protocolo: string | null;
  url_danfe: string | null;
  qrcode_url: string | null;
  mensagem_sefaz: string | null;
  ref_externa: string;
};

export function VendaDetailsDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const [data, setData] = useState<Detail | null>(null);
  const [nfce, setNfce] = useState<NFCe | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprinting, setReprinting] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [preview, setPreview] = useState<ReceiptData | null>(null);

  const reload = () => {
    setLoading(true);
    // Fetch each independently — a failing fiscal query (e.g., pending migration) should not block the sale details
    api.erp.sales
      .get(id)
      .then((sale) => setData(sale as Detail | null))
      .catch((e) => {
        toast.error('Erro ao carregar venda: ' + (e as Error).message);
        setData(null);
      })
      .finally(() => setLoading(false));
    api.fiscal
      .getByVenda(id)
      .then((n) => setNfce(n as NFCe | null))
      .catch(() => setNfce(null));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const r = await api.fiscal.retryOne(id);
      if (r.ok) toast.success('NFCe autorizada!');
      else toast.warning(r.mensagem ?? r.status);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setRetrying(false);
  };

  const handleCancel = async () => {
    if (!nfce) return;
    if (cancelReason.trim().length < 15) {
      toast.error('A justificativa deve ter no mínimo 15 caracteres');
      return;
    }
    setCancelling(true);
    try {
      const r = await api.fiscal.cancelNFCe({ ref: nfce.ref_externa, justificativa: cancelReason.trim() });
      if (r.ok) toast.success('NFCe cancelada');
      else toast.warning(r.mensagem ?? r.status);
      setCancelOpen(false);
      setCancelReason('');
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setCancelling(false);
  };

  const showPreview = async () => {
    if (!data) return;
    const company = (await api.pdv.getCompany()) ?? {};
    const payments: Array<{ label: string; valor: number }> = [];
    if (Number(data.header.vr_dinheiro) > 0) payments.push({ label: 'Dinheiro', valor: Number(data.header.vr_dinheiro) });
    if (Number(data.header.vr_cheque) > 0) payments.push({ label: 'Cheque', valor: Number(data.header.vr_cheque) });
    if (Number(data.header.vr_cartao) > 0) payments.push({ label: 'Cartão', valor: Number(data.header.vr_cartao) });
    if (Number(data.header.vr_carne) > 0) payments.push({ label: 'Carnê', valor: Number(data.header.vr_carne) });
    if (Number(data.header.vr_ticket) > 0) payments.push({ label: 'Ticket', valor: Number(data.header.vr_ticket) });
    const subtotal = data.items.reduce((s, i) => s + Number(i.vr_total), 0);
    const total = Number(data.header.vr_total);
    const desconto = Math.max(0, subtotal - total);
    const troco = Math.max(0, payments.reduce((s, p) => s + p.valor, 0) - total);
    setPreview({
      company,
      control: data.header.controle,
      items: data.items.map((i) => ({
        nome_produto: i.nome_produto,
        quant: Number(i.quant),
        valor: Number(i.valor),
        vr_total: Number(i.vr_total),
        unidade: i.unidade ?? 'UN',
      })),
      payments,
      subtotal,
      desconto,
      total,
      troco,
      cliente: data.header.nome_cliente ? { nome: data.header.nome_cliente, cpf_cnpj: data.header.cpf_cnpj ?? undefined } : undefined,
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

  const reprint = async () => {
    if (!data) return;
    setReprinting(true);
    try {
      const company = (await api.pdv.getCompany()) ?? {};
      const payments: Array<{ label: string; valor: number }> = [];
      if (Number(data.header.vr_dinheiro) > 0) payments.push({ label: 'Dinheiro', valor: Number(data.header.vr_dinheiro) });
      if (Number(data.header.vr_cheque) > 0) payments.push({ label: 'Cheque', valor: Number(data.header.vr_cheque) });
      if (Number(data.header.vr_cartao) > 0) payments.push({ label: 'Cartão', valor: Number(data.header.vr_cartao) });
      if (Number(data.header.vr_carne) > 0) payments.push({ label: 'Carnê', valor: Number(data.header.vr_carne) });
      if (Number(data.header.vr_ticket) > 0) payments.push({ label: 'Ticket', valor: Number(data.header.vr_ticket) });
      const subtotal = data.items.reduce((s, i) => s + Number(i.vr_total), 0);
      const total = Number(data.header.vr_total);
      const desconto = Math.max(0, subtotal - total);
      const troco = Math.max(0, payments.reduce((s, p) => s + p.valor, 0) - total);

      const r = await api.pdv.printReceipt({
        company,
        control: data.header.controle,
        items: data.items.map((i) => ({
          nome_produto: i.nome_produto,
          quant: Number(i.quant),
          valor: Number(i.valor),
          vr_total: Number(i.vr_total),
          unidade: i.unidade ?? 'UN',
        })),
        payments,
        subtotal,
        desconto,
        total,
        troco,
        cliente: data.header.nome_cliente ? { nome: data.header.nome_cliente, cpf_cnpj: data.header.cpf_cnpj ?? undefined } : undefined,
      });
      if (r.ok) toast.success('Cupom reimpresso');
      else toast.error(r.error ?? 'Falha na impressão');
    } catch (e) {
      toast.error((e as Error).message);
    }
    setReprinting(false);
  };

  return (
    <>
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalhes da venda</DialogTitle>
        </DialogHeader>

        {loading || !data ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-black/20 p-3">
                <div className="text-xs uppercase text-muted-foreground">Controle</div>
                <div className="font-mono">{data.header.controle}</div>
              </div>
              <div className="rounded-lg bg-black/20 p-3">
                <div className="text-xs uppercase text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Data
                </div>
                <div>{new Date(data.header.data_venda).toLocaleDateString('pt-BR')}</div>
              </div>
              <div className="rounded-lg bg-black/20 p-3">
                <div className="text-xs uppercase text-muted-foreground flex items-center gap-1">
                  <User className="w-3 h-3" /> Cliente
                </div>
                <div>{data.header.nome_cliente ?? 'Consumidor'}</div>
              </div>
            </div>

            <div className="rounded-xl border border-white/5 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-black/20 text-xs uppercase text-muted-foreground">
                    <th className="text-left px-3 py-2">Produto</th>
                    <th className="text-right px-3 py-2">Qtd</th>
                    <th className="text-right px-3 py-2">Valor</th>
                    <th className="text-right px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it) => (
                    <tr key={it.id} className="border-t border-white/5">
                      <td className="px-3 py-2">{it.nome_produto}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {Number(it.quant).toLocaleString('pt-BR')} {it.unidade}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(it.valor))}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {formatCurrency(Number(it.vr_total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 text-sm">
                <div className="text-xs uppercase text-muted-foreground mb-2">Formas de pagamento</div>
                {Number(data.header.vr_dinheiro) > 0 && <div className="flex justify-between"><span>Dinheiro</span><span>{formatCurrency(Number(data.header.vr_dinheiro))}</span></div>}
                {Number(data.header.vr_cheque) > 0 && <div className="flex justify-between"><span>Cheque</span><span>{formatCurrency(Number(data.header.vr_cheque))}</span></div>}
                {Number(data.header.vr_cartao) > 0 && <div className="flex justify-between"><span>Cartão</span><span>{formatCurrency(Number(data.header.vr_cartao))}</span></div>}
                {Number(data.header.vr_carne) > 0 && <div className="flex justify-between"><span>Carnê</span><span>{formatCurrency(Number(data.header.vr_carne))}</span></div>}
                {Number(data.header.vr_ticket) > 0 && <div className="flex justify-between"><span>Ticket</span><span>{formatCurrency(Number(data.header.vr_ticket))}</span></div>}
              </div>
              <div className="rounded-xl bg-black/30 p-4 text-right">
                <div className="text-xs uppercase text-muted-foreground">Total da venda</div>
                <div className="text-3xl font-bold tabular-nums text-success">
                  {formatCurrency(Number(data.header.vr_total))}
                </div>
              </div>
            </div>

            {nfce && (
              <div className={cn(
                'rounded-xl border p-3 space-y-2',
                nfce.status === 'autorizado' ? 'bg-success/5 border-success/30' :
                nfce.status === 'cancelado' ? 'bg-muted border-white/10' :
                nfce.status.includes('erro') ? 'bg-destructive/5 border-destructive/30' :
                'bg-warning/5 border-warning/30'
              )}>
                <div className="flex items-center gap-2">
                  {nfce.status === 'autorizado' && <FileCheck2 className="w-4 h-4 text-success" />}
                  {nfce.status === 'cancelado' && <Ban className="w-4 h-4 text-muted-foreground" />}
                  {nfce.status.includes('erro') && <AlertCircle className="w-4 h-4 text-destructive" />}
                  {(nfce.status === 'pendente' || nfce.status === 'processando_autorizacao') && <Clock className="w-4 h-4 text-warning" />}
                  <span className="font-semibold text-sm uppercase">NFCe {nfce.status.replace(/_/g, ' ')}</span>
                </div>
                {nfce.chave_nfe && (
                  <div className="text-[11px] font-mono text-muted-foreground break-all">{nfce.chave_nfe}</div>
                )}
                {nfce.mensagem_sefaz && (
                  <div className="text-xs text-muted-foreground">{nfce.mensagem_sefaz}</div>
                )}
                <div className="flex gap-2 pt-1">
                  {nfce.qrcode_url && (
                    <a href={nfce.qrcode_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                      QR Code <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {nfce.url_danfe && (
                    <a href={nfce.url_danfe} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                      DANFE <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between gap-2">
              <div className="flex gap-2">
                {nfce && nfce.status === 'autorizado' && (
                  <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                    <Ban className="w-4 h-4" /> Cancelar NFCe
                  </Button>
                )}
                {nfce && (nfce.status === 'pendente' || nfce.status.includes('erro') || nfce.status === 'processando_autorizacao') && (
                  <Button variant="outline" onClick={handleRetry} disabled={retrying}>
                    {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                    Reenviar NFCe
                  </Button>
                )}
                {!nfce && (
                  <Button variant="outline" onClick={handleRetry} disabled={retrying}>
                    {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Emitir NFCe
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={showPreview}>
                  <Eye className="w-4 h-4" /> Ver nota
                </Button>
                <Button onClick={reprint} disabled={reprinting}>
                  {reprinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  Reimprimir
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {preview && <ReceiptPreview data={preview} onClose={() => setPreview(null)} />}

    <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto w-14 h-14 rounded-xl bg-destructive/10 flex items-center justify-center mb-2">
              <Ban className="w-7 h-7 text-destructive" />
            </div>
            <DialogTitle className="text-center">Cancelar NFCe</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            O cancelamento só é permitido pela SEFAZ dentro de <strong>30 minutos</strong> após a autorização.
            Uma justificativa clara é obrigatória (mín. 15 caracteres).
          </div>
          <FormField label="Justificativa" hint={`${cancelReason.length} / 15 caracteres mínimo`}>
            <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Ex.: Erro na emissão dos itens" maxLength={255} />
          </FormField>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={cancelling}>Voltar</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling || cancelReason.trim().length < 15}>
              {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
