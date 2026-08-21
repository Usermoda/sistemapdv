import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

export type ReceiptData = {
  company?: {
    nome_empresa?: string;
    cpf_cpnj?: string;
    endereco?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    telefone?: string;
  };
  control: string;
  operator?: string;
  items: Array<{
    nome_produto: string;
    quant: number;
    valor: number;
    vr_total: number;
    unidade?: string;
  }>;
  payments: Array<{ label: string; valor: number }>;
  subtotal: number;
  desconto: number;
  total: number;
  troco: number;
  cliente?: { nome?: string; cpf_cnpj?: string };
  nfce?: {
    chave_nfe: string;
    numero?: number | null;
    serie?: number | null;
    protocolo?: string | null;
    qrcode_url?: string | null;
    ambiente?: 'homologacao' | 'producao' | null;
  } | null;
};

export function ReceiptPreview({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  const printOnThermal = async () => {
    try {
      const r = await api.pdv.printReceipt(
        {
          company: data.company ?? {},
          control: data.control,
          operator: data.operator,
          items: data.items,
          payments: data.payments,
          subtotal: data.subtotal,
          desconto: data.desconto,
          total: data.total,
          troco: data.troco,
          cliente: data.cliente,
          nfce: data.nfce ?? null,
        },
        data.payments.some((p) => p.label.toLowerCase().includes('dinheiro'))
      );
      if (r.ok) toast.success('Cupom enviado para a impressora');
      else toast.error(r.error ?? 'Falha na impressão');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const openInWindow = () => {
    // Uses a hidden iframe (window.open is blocked by Electron's setWindowOpenHandler)
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Comprovante</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 8px; color: #000; background: #fff; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .big { font-size: 14px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; }
</style></head><body>${renderPlainHtml(data)}</body></html>`;

    // Remove any previous receipt iframe
    document.querySelectorAll('iframe[data-receipt="1"]').forEach((el) => el.remove());

    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-receipt', '1');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.opacity = '0';
    iframe.style.border = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    // Use srcdoc for reliability across Electron/browser
    iframe.srcdoc = html;

    iframe.onload = () => {
      // Wait a beat so images (QR) settle before triggering print
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          toast.error('Falha ao abrir impressão: ' + (e as Error).message);
        }
        // Cleanup after user closes print dialog
        setTimeout(() => iframe.remove(), 60_000);
      }, 400);
    };
  };

  const c = data.company ?? {};

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent hideClose className="p-0 gap-0 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
          <div className="text-sm font-semibold">Comprovante de venda</div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={openInWindow} title="Abrir em nova janela / Ctrl+P">
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={printOnThermal} title="Enviar para impressora térmica">
              <Printer className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} title="Fechar">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Paper preview */}
        <div className="overflow-auto p-4 bg-neutral-200">
          <div className="mx-auto max-w-[340px] bg-white text-black font-mono text-[12px] leading-tight p-4 shadow-lg">
            <div className="text-center font-bold text-[14px]">{c.nome_empresa ?? 'CUPOM DE VENDA'}</div>
            {c.cpf_cpnj && <div className="text-center text-[11px]">CNPJ: {c.cpf_cpnj}</div>}
            {c.endereco && <div className="text-center text-[11px]">{c.endereco}</div>}
            {(c.bairro || c.cidade || c.uf) && (
              <div className="text-center text-[11px]">{[c.bairro, c.cidade, c.uf].filter(Boolean).join(' - ')}</div>
            )}
            {c.telefone && <div className="text-center text-[11px]">Tel: {c.telefone}</div>}
            <Dashed />

            <div className="text-[11px]">CUPOM NÃO FISCAL</div>
            <div className="text-[11px]">Controle: {data.control}</div>
            <div className="text-[11px]">Data: {new Date().toLocaleString('pt-BR')}</div>
            {data.operator && <div className="text-[11px]">Operador: {data.operator}</div>}
            {data.cliente?.nome && <div className="text-[11px]">Cliente: {data.cliente.nome}</div>}
            {data.cliente?.cpf_cnpj && <div className="text-[11px]">CPF/CNPJ: {data.cliente.cpf_cnpj}</div>}
            <Dashed />

            <div className="flex justify-between font-bold text-[11px]">
              <span>ITEM</span>
              <span>VALOR</span>
            </div>
            {data.items.map((it, i) => (
              <div key={i} className="mt-1">
                <div className="text-[11px]">{it.nome_produto}</div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-neutral-600">
                    {' '}{it.quant.toLocaleString('pt-BR')} {it.unidade ?? 'UN'} x {formatCurrency(it.valor)}
                  </span>
                  <span>{formatCurrency(it.vr_total)}</span>
                </div>
              </div>
            ))}
            <Dashed />

            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatCurrency(data.subtotal)}</span>
            </div>
            {data.desconto > 0 && (
              <div className="flex justify-between">
                <span>Desconto:</span>
                <span>- {formatCurrency(data.desconto)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-[15px] mt-1">
              <span>TOTAL:</span>
              <span>{formatCurrency(data.total)}</span>
            </div>
            <Dashed />

            <div className="font-bold text-[11px]">FORMAS DE PAGAMENTO</div>
            {data.payments.map((p, i) => (
              <div key={i} className="flex justify-between text-[11px]">
                <span>{p.label}:</span>
                <span>{formatCurrency(p.valor)}</span>
              </div>
            ))}
            {data.troco > 0 && (
              <div className="flex justify-between font-bold mt-1">
                <span>TROCO:</span>
                <span>{formatCurrency(data.troco)}</span>
              </div>
            )}

            {data.nfce?.chave_nfe && (
              <>
                <Dashed />
                <div className="text-center font-bold">NFC-e</div>
                {data.nfce.numero && data.nfce.serie && (
                  <div className="text-center text-[11px]">Nº {data.nfce.numero} Série {data.nfce.serie}</div>
                )}
                <div className="text-center text-[10px] break-all">
                  {data.nfce.chave_nfe.replace(/(.{4})/g, '$1 ').trim()}
                </div>
                {data.nfce.protocolo && (
                  <div className="text-center text-[11px]">Protocolo: {data.nfce.protocolo}</div>
                )}
                {data.nfce.ambiente === 'homologacao' && (
                  <div className="text-center font-bold text-[11px] my-1">
                    *** SEM VALOR FISCAL - HOMOLOGACAO ***
                  </div>
                )}
                {data.nfce.qrcode_url && (
                  <div className="flex justify-center my-2">
                    <img
                      alt="QR NFCe"
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(data.nfce.qrcode_url)}`}
                      width={160}
                      height={160}
                    />
                  </div>
                )}
                <div className="text-center text-[10px]">Consulta em www.nfce.fazenda.gov.br</div>
              </>
            )}

            <Dashed />
            <div className="text-center text-[11px] font-bold">OBRIGADO PELA PREFERÊNCIA</div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-white/5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={openInWindow}>
            <Download className="w-4 h-4" /> Abrir / Ctrl+P
          </Button>
          <Button className="flex-1" onClick={printOnThermal}>
            <Printer className="w-4 h-4" /> Impressora térmica
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Dashed() {
  return <div className="border-t border-dashed border-neutral-400 my-1.5" />;
}

function renderPlainHtml(data: ReceiptData): string {
  const c = data.company ?? {};
  const money = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const esc = escapeHtml;
  const parts: string[] = [];
  parts.push(`<div class="center bold big">${esc(c.nome_empresa ?? 'CUPOM DE VENDA')}</div>`);
  if (c.cpf_cpnj) parts.push(`<div class="center">CNPJ: ${esc(c.cpf_cpnj)}</div>`);
  if (c.endereco) parts.push(`<div class="center">${esc(c.endereco)}</div>`);
  const cityLine = [c.bairro, c.cidade, c.uf].filter(Boolean).join(' - ');
  if (cityLine) parts.push(`<div class="center">${esc(cityLine)}</div>`);
  if (c.telefone) parts.push(`<div class="center">Tel: ${esc(c.telefone)}</div>`);
  parts.push('<hr/>');
  parts.push(`<div>CUPOM NÃO FISCAL</div>`);
  parts.push(`<div>Controle: ${esc(data.control)}</div>`);
  parts.push(`<div>Data: ${new Date().toLocaleString('pt-BR')}</div>`);
  if (data.operator) parts.push(`<div>Operador: ${esc(data.operator)}</div>`);
  if (data.cliente?.nome) parts.push(`<div>Cliente: ${esc(data.cliente.nome)}</div>`);
  if (data.cliente?.cpf_cnpj) parts.push(`<div>CPF/CNPJ: ${esc(data.cliente.cpf_cnpj)}</div>`);
  parts.push('<hr/>');
  parts.push('<table>');
  parts.push(`<tr><td class="bold">ITEM</td><td class="bold right">VALOR</td></tr>`);
  for (const it of data.items) {
    parts.push(`<tr><td colspan="2">${esc(it.nome_produto)}</td></tr>`);
    parts.push(`<tr><td> ${it.quant.toLocaleString('pt-BR')} ${esc(it.unidade ?? 'UN')} x ${money(it.valor)}</td><td class="right">${money(it.vr_total)}</td></tr>`);
  }
  parts.push('</table><hr/>');
  parts.push(`<div class="row"><span>Subtotal:</span><span>${money(data.subtotal)}</span></div>`);
  if (data.desconto > 0) parts.push(`<div class="row"><span>Desconto:</span><span>- ${money(data.desconto)}</span></div>`);
  parts.push(`<div class="row bold big"><span>TOTAL:</span><span>${money(data.total)}</span></div>`);
  parts.push('<hr/>');
  parts.push('<div class="bold">FORMAS DE PAGAMENTO</div>');
  for (const p of data.payments) parts.push(`<div class="row"><span>${esc(p.label)}:</span><span>${money(p.valor)}</span></div>`);
  if (data.troco > 0) parts.push(`<div class="row bold"><span>TROCO:</span><span>${money(data.troco)}</span></div>`);
  if (data.nfce?.chave_nfe) {
    parts.push('<hr/>');
    parts.push('<div class="center bold">NFC-e</div>');
    if (data.nfce.numero && data.nfce.serie) parts.push(`<div class="center">Nº ${data.nfce.numero} Série ${data.nfce.serie}</div>`);
    parts.push(`<div class="center" style="word-break:break-all;font-size:10px">${esc(data.nfce.chave_nfe.replace(/(.{4})/g, '$1 ').trim())}</div>`);
    if (data.nfce.protocolo) parts.push(`<div class="center">Protocolo: ${esc(data.nfce.protocolo)}</div>`);
    if (data.nfce.ambiente === 'homologacao') parts.push(`<div class="center bold">*** SEM VALOR FISCAL - HOMOLOGACAO ***</div>`);
    if (data.nfce.qrcode_url) {
      const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.nfce.qrcode_url)}`;
      parts.push(`<div class="center"><img src="${qr}" width="200" height="200"/></div>`);
    }
    parts.push('<div class="center" style="font-size:10px">Consulta em www.nfce.fazenda.gov.br</div>');
  }
  parts.push('<hr/>');
  parts.push('<div class="center bold">OBRIGADO PELA PREFERÊNCIA</div>');
  return parts.join('');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
