import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Banknote, CheckCircle2, CreditCard, Eye, FileCheck2, Loader2, Printer, Trash2, Wallet, Ticket, Landmark } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Numpad, parseMoney } from '@/components/Numpad';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { usePdv } from '@/stores/pdvStore';
import { useAuth } from '@/stores/authStore';
import { usePrefs } from '@/stores/prefsStore';
import { formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ReceiptPreview, type ReceiptData } from './ReceiptPreview';

type PaymentMethodRow = { id: number; modo_lancamento: string; protegido: string | null };

const iconFor = (id: number) => {
  if (id === 1) return Banknote;
  if (id === 6 || id === 7) return CreditCard;
  if (id === 4) return Landmark;
  if (id === 8) return Ticket;
  return Wallet;
};

export function CheckoutDialog({ open, onOpenChange, onComplete }: { open: boolean; onOpenChange: (o: boolean) => void; onComplete: () => void }) {
  const items = usePdv((s) => s.items);
  const cliente = usePdv((s) => s.cliente);
  const desconto = usePdv((s) => s.desconto);
  const observacao = usePdv((s) => s.observacao);
  const setDesconto = usePdv((s) => s.setDesconto);
  const setObservacao = usePdv((s) => s.setObservacao);
  const clear = usePdv((s) => s.clear);
  const subtotal = usePdv((s) => s.subtotal());
  const total = usePdv((s) => s.total());
  const session = useAuth((s) => s.session);
  const touchMode = usePrefs((s) => s.touchMode);
  const successEnabled = usePrefs((s) => s.successEnabled);
  const successAutoClose = usePrefs((s) => s.successAutoClose);
  const [countdown, setCountdown] = useState(0);

  const [methods, setMethods] = useState<PaymentMethodRow[]>([]);
  const [payments, setPayments] = useState<Array<{ cod_lancamento: number; label: string; valor: number }>>([]);
  const [selectedMethod, setSelectedMethod] = useState<number | null>(null);
  const [amountRaw, setAmountRaw] = useState('');
  const [descontoRaw, setDescontoRaw] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ control: string; idVenda: number } | null>(null);
  const [nfce, setNfce] = useState<{ status: string; chave_nfe?: string; qrcode_url?: string; url_danfe?: string; mensagem?: string } | null>(null);
  const [nfceLoading, setNfceLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setDone(null);
    setNfce(null);
    setPayments([]);
    // Pre-fill value with the sale total (restante inicial = total)
    setAmountRaw(total > 0 ? total.toFixed(2).replace('.', ',') : '');
    setDescontoRaw(desconto > 0 ? String(desconto).replace('.', ',') : '');
    api.pdv.listPaymentMethods().then((m) => {
      setMethods(m);
      if (m.length > 0) setSelectedMethod(m[0].id);
    });
    // Auto-focus & select all after dialog animation
    setTimeout(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    }, 120);
  }, [open, desconto, total]);

  const totalPago = useMemo(() => payments.reduce((s, p) => s + p.valor, 0), [payments]);
  const restante = Math.max(0, total - totalPago);
  const troco = Math.max(0, totalPago - total);

  const applyDesconto = () => setDesconto(parseMoney(descontoRaw));

  const quickAmounts = [restante, total, 10, 20, 50, 100];

  const addPayment = () => {
    if (!selectedMethod) return;
    const label = methods.find((m) => m.id === selectedMethod)?.modo_lancamento ?? '';
    const valor = parseMoney(amountRaw) || restante;
    if (valor <= 0) return;
    const nextTotal = totalPago + valor;
    setPayments((prev) => [...prev, { cod_lancamento: selectedMethod, label, valor }]);
    const nextRestante = Math.max(0, total - nextTotal);
    setAmountRaw(nextRestante > 0 ? nextRestante.toFixed(2).replace('.', ',') : '');
    setTimeout(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    }, 50);
  };

  const removePayment = (idx: number) => {
    setPayments((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      const nextTotalPago = next.reduce((s, p) => s + p.valor, 0);
      const nextRestante = Math.max(0, total - nextTotalPago);
      // Refill the amount input with the new remaining so the operator can add the next form directly
      setAmountRaw(nextRestante > 0 ? nextRestante.toFixed(2).replace('.', ',') : '');
      setTimeout(() => {
        amountInputRef.current?.focus();
        amountInputRef.current?.select();
      }, 30);
      return next;
    });
  };

  // When the operator changes the payment method, refill the amount with the current remaining
  const handleSelectMethod = (id: number) => {
    setSelectedMethod(id);
    setAmountRaw(restante > 0 ? restante.toFixed(2).replace('.', ',') : '');
    setTimeout(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    }, 30);
  };

  // Keyboard shortcuts scoped to the checkout dialog
  useEffect(() => {
    if (!open || done) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // F5 or Ctrl+Enter — confirm sale (works from anywhere)
      if (
        (e.key === 'F5' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) &&
        (totalPago + parseMoney(amountRaw)) >= total &&
        total > 0
      ) {
        e.preventDefault();
        void confirmSale();
        return;
      }

      // Enter on the amount input — add payment; if already paid, confirm sale
      if (e.key === 'Enter' && inField && target === amountInputRef.current) {
        e.preventDefault();
        if (totalPago >= total && total > 0 && parseMoney(amountRaw) <= 0) {
          void confirmSale();
        } else {
          addPayment();
        }
        return;
      }

      // Number keys 1-9 (outside fields) — quick-select payment method by position
      if (!inField && /^[1-9]$/.test(e.key) && methods.length >= Number(e.key)) {
        const idx = Number(e.key) - 1;
        const m = methods[idx];
        if (m) {
          e.preventDefault();
          handleSelectMethod(m.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, done, totalPago, total, amountRaw, methods]);

  const confirmSale = async () => {
    // Auto-add any pending amount typed in the input if it can complete the sale
    let effectivePayments = payments;
    const pending = parseMoney(amountRaw);
    if (pending > 0 && selectedMethod) {
      const label = methods.find((m) => m.id === selectedMethod)?.modo_lancamento ?? '';
      effectivePayments = [...payments, { cod_lancamento: selectedMethod, label, valor: pending }];
      setPayments(effectivePayments);
      setAmountRaw('');
    }
    const totalWithPending = effectivePayments.reduce((s, p) => s + p.valor, 0);
    if (totalWithPending < total) {
      toast.error('Valor pago insuficiente');
      return;
    }
    setSaving(true);
    try {
      const trocoCalc = Math.max(0, totalWithPending - total);
      const saveRes = await api.pdv.saveSale({
        items: items.map((i) => ({
          id_produto: i.id_produto,
          nome_produto: i.nome_produto,
          valor: i.valor,
          quant: i.quant,
          vr_total: i.valor * i.quant,
        })),
        payments: effectivePayments.map((p) => ({ cod_lancamento: p.cod_lancamento, valor: p.valor })),
        id_cliente: cliente?.id,
        vr_total: total,
        vr_desconto: desconto,
        vr_troco: trocoCalc,
        observacao: observacao || undefined,
        id_login: session?.id,
      });

      if (saveRes.ok) {
        setDone({ control: saveRes.control, idVenda: saveRes.idVenda });
        toast.success('Venda registrada!');
        // Fetch company for receipt preview
        const company = (await api.pdv.getCompany()) ?? {};
        setReceiptData({
          company,
          control: saveRes.control,
          operator: session?.login,
          items: items.map((i) => ({ nome_produto: i.nome_produto, quant: i.quant, valor: i.valor, vr_total: i.valor * i.quant, unidade: i.unidade })),
          payments: effectivePayments.map((p) => ({ label: p.label, valor: p.valor })),
          subtotal,
          desconto,
          total,
          troco: trocoCalc,
          cliente: cliente ? { nome: cliente.nome_cliente, cpf_cnpj: cliente.cpf_cnpj ?? undefined } : undefined,
          nfce: null,
        });

        // NFCe emission (non-blocking) — only if fiscal is enabled
        let emissionResult: {
          ok: boolean;
          status: string;
          chave_nfe?: string;
          numero?: number;
          serie?: number;
          protocolo?: string;
          qrcode_url?: string;
          url_danfe?: string;
          mensagem?: string;
        } | null = null;
        let ambiente: 'homologacao' | 'producao' = 'homologacao';
        try {
          const fiscalCfg = await api.fiscal.getSettings();
          if (fiscalCfg.enabled && fiscalCfg.provider !== 'none') {
            ambiente = fiscalCfg.ambiente;
            setNfceLoading(true);
            emissionResult = await api.fiscal.emitNFCe(saveRes.idVenda);
            setNfce({
              status: emissionResult.status,
              chave_nfe: emissionResult.chave_nfe,
              qrcode_url: emissionResult.qrcode_url,
              url_danfe: emissionResult.url_danfe,
              mensagem: emissionResult.mensagem,
            });
            // Attach NFCe to receipt data if authorized
            if (emissionResult.ok && emissionResult.chave_nfe) {
              setReceiptData((prev) => prev ? {
                ...prev,
                nfce: {
                  chave_nfe: emissionResult!.chave_nfe!,
                  numero: emissionResult!.numero ?? null,
                  serie: emissionResult!.serie ?? null,
                  protocolo: emissionResult!.protocolo ?? null,
                  qrcode_url: emissionResult!.qrcode_url ?? null,
                  ambiente,
                },
              } : prev);
            }
            setNfceLoading(false);
          }
        } catch {
          setNfceLoading(false);
        }

        // Try to print — non-blocking; include NFCe data if authorized
        let printerConfigured = false;
        let autoPreviewMode: 'always' | 'when-no-printer' | 'never' = 'when-no-printer';
        try {
          const printerCfg = await api.printer.getConfig();
          printerConfigured = !!printerCfg.configured;
          autoPreviewMode = printerCfg.autoPreview ?? 'when-no-printer';
          if (printerConfigured) {
            await api.pdv.printReceipt(
              {
                company,
                control: saveRes.control,
                items: items.map((i) => ({ nome_produto: i.nome_produto, quant: i.quant, valor: i.valor, vr_total: i.valor * i.quant, unidade: i.unidade })),
                payments: effectivePayments.map((p) => ({ label: p.label, valor: p.valor })),
                subtotal,
                desconto,
                total,
                troco: trocoCalc,
                cliente: cliente ? { nome: cliente.nome_cliente, cpf_cnpj: cliente.cpf_cnpj ?? undefined } : undefined,
                nfce:
                  emissionResult && emissionResult.ok && emissionResult.chave_nfe
                    ? {
                        chave_nfe: emissionResult.chave_nfe,
                        numero: emissionResult.numero ?? null,
                        serie: emissionResult.serie ?? null,
                        protocolo: emissionResult.protocolo ?? null,
                        qrcode_url: emissionResult.qrcode_url ?? null,
                        ambiente,
                      }
                    : null,
              },
              effectivePayments.some((p) => p.cod_lancamento === 1) // abrir gaveta se recebeu dinheiro
            );
          }
        } catch {
          // ignore print errors — venda já foi salva
        }

        // Auto-open preview based on user preference
        const shouldAutoPreview =
          autoPreviewMode === 'always' ||
          (autoPreviewMode === 'when-no-printer' && !printerConfigured);
        if (shouldAutoPreview) {
          setPreviewOpen(true);
        }
      }
    } catch (e) {
      toast.error(`Erro ao salvar: ${(e as Error).message}`);
    }
    setSaving(false);
  };

  const closeAndReset = () => {
    onOpenChange(false);
    if (done) {
      clear();
      onComplete();
    }
  };

  // If success screen is disabled, close after the preview also closes (or immediately if preview never opens).
  // We wait 1000ms after `done` becomes true to allow async post-sale work (NFCe emit, printer check) to run
  // and potentially set previewOpen=true. If it doesn't open by then, we close.
  useEffect(() => {
    if (done && !successEnabled && !previewOpen) {
      const t = setTimeout(() => closeAndReset(), 1000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, successEnabled, previewOpen]);

  // Auto-close countdown for the success screen
  useEffect(() => {
    if (!done || !successEnabled || successAutoClose <= 0) {
      setCountdown(0);
      return;
    }
    setCountdown(successAutoClose);
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = Math.max(0, successAutoClose - elapsed);
      setCountdown(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        closeAndReset();
      }
    }, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, successEnabled, successAutoClose]);

  // Keyboard shortcuts on the success screen
  useEffect(() => {
    if (!done || !successEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        closeAndReset();
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        setPreviewOpen(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeAndReset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, successEnabled]);

  // When the success screen is disabled, render only the preview (if open) and skip the confirmation UI.
  if (done && !successEnabled) {
    if (previewOpen && receiptData) {
      return <ReceiptPreview data={{ ...receiptData, operator: session?.login }} onClose={() => { setPreviewOpen(false); closeAndReset(); }} />;
    }
    // Not showing anything — the useEffect above will trigger closeAndReset shortly.
    return null;
  }

  if (done) {
    return (
      <Dialog open={open} onOpenChange={closeAndReset}>
        <DialogContent hideClose className="max-w-md">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center space-y-4 py-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-success" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Venda concluída</h2>
              <p className="text-sm text-muted-foreground mt-1">Controle #{done.control}</p>
            </div>
            <div className="rounded-xl bg-black/30 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Total pago</div>
              <div className="text-3xl font-bold tabular-nums">{formatCurrency(totalPago)}</div>
              {troco > 0 && (
                <div className="mt-2 text-warning">
                  <span className="text-xs">Troco:</span> <span className="font-semibold">{formatCurrency(troco)}</span>
                </div>
              )}
            </div>

            {nfceLoading && (
              <div className="rounded-xl bg-primary/10 border border-primary/30 p-3 flex items-center gap-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Emitindo NFCe...
              </div>
            )}
            {nfce && (
              <div className={`rounded-xl border p-3 text-sm ${nfce.status === 'autorizado' ? 'bg-success/10 border-success/30' : 'bg-warning/10 border-warning/30'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {nfce.status === 'autorizado' ? (
                    <FileCheck2 className="w-4 h-4 text-success" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-warning" />
                  )}
                  <span className="font-semibold uppercase text-xs">
                    NFCe {nfce.status === 'autorizado' ? 'autorizada' : nfce.status.replace(/_/g, ' ')}
                  </span>
                </div>
                {nfce.chave_nfe && (
                  <div className="text-[10px] font-mono text-muted-foreground break-all">{nfce.chave_nfe}</div>
                )}
                {nfce.mensagem && !nfce.chave_nfe && (
                  <div className="text-xs text-muted-foreground">{nfce.mensagem}</div>
                )}
                {nfce.qrcode_url && (
                  <a href={nfce.qrcode_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block">
                    Ver QR Code / consulta pública
                  </a>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="lg" className="flex-1" onClick={() => setPreviewOpen(true)}>
                <Eye className="w-4 h-4" /> Ver nota
                <kbd className="ml-auto text-[10px] px-1 rounded bg-white/10 font-mono">V</kbd>
              </Button>
              <Button size="lg" className="flex-1" onClick={closeAndReset}>
                Nova venda
                {countdown > 0 ? (
                  <span className="ml-2 text-xs opacity-70">({countdown}s)</span>
                ) : (
                  <kbd className="ml-auto text-[10px] px-1 rounded bg-primary-foreground/20 font-mono">Enter</kbd>
                )}
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={closeAndReset} className="w-full">
              Fechar <kbd className="ml-2 text-[10px] px-1 rounded bg-white/10 font-mono">Esc</kbd>
            </Button>
            {previewOpen && receiptData && (
              <ReceiptPreview data={{ ...receiptData, operator: session?.login }} onClose={() => setPreviewOpen(false)} />
            )}
          </motion.div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Finalizar venda</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-3 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {methods.map((m, idx) => {
                const Icon = iconFor(m.id);
                const active = selectedMethod === m.id;
                const shortcut = idx < 9 ? String(idx + 1) : null;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleSelectMethod(m.id)}
                    className={cn(
                      'relative p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 touch-target',
                      active ? 'border-primary bg-primary/10' : 'border-white/5 hover:border-white/20'
                    )}
                  >
                    {shortcut && (
                      <kbd
                        className={cn(
                          'absolute top-1 right-1 text-[9px] font-mono px-1 rounded',
                          active ? 'bg-primary/30 text-primary' : 'bg-white/10 text-muted-foreground'
                        )}
                      >
                        {shortcut}
                      </kbd>
                    )}
                    <Icon className={cn('w-5 h-5', active ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="text-[11px] font-medium text-center leading-tight">{m.modo_lancamento}</span>
                  </button>
                );
              })}
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Valor</label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  ref={amountInputRef}
                  value={amountRaw}
                  readOnly={touchMode}
                  onChange={(e) => setAmountRaw(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  placeholder="0,00"
                  inputMode="decimal"
                  className="text-2xl h-14 tabular-nums font-bold"
                />
                <Button size="lg" onClick={addPayment} disabled={!selectedMethod}>
                  Adicionar
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {quickAmounts.filter((v) => v > 0).map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmountRaw(v.toFixed(2).replace('.', ','))}
                    className="text-xs px-2 py-1 rounded-md bg-secondary hover:bg-secondary/70 transition"
                  >
                    R$ {v.toFixed(2).replace('.', ',')}
                  </button>
                ))}
              </div>
            </div>

            {touchMode && <Numpad value={amountRaw} onChange={setAmountRaw} compact />}

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Pagamentos adicionados</div>
              {payments.length === 0 && (
                <div className="text-sm text-muted-foreground p-3 rounded-lg bg-black/20">
                  Nenhum pagamento adicionado
                </div>
              )}
              {payments.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2 p-3 rounded-lg bg-card border border-white/5">
                  <span className="text-sm flex-1">{p.label}</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(p.valor)}</span>
                  <button onClick={() => removePayment(idx)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="rounded-xl bg-black/30 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground flex-1">Desconto</label>
                <Input value={descontoRaw} onChange={(e) => setDescontoRaw(e.target.value)} onBlur={applyDesconto} className="w-24 text-right" placeholder="0,00" />
              </div>
              <div className="pt-2 mt-2 border-t border-white/5 flex justify-between items-baseline">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-3xl font-bold tabular-nums">{formatCurrency(total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pago</span>
                <span className="tabular-nums">{formatCurrency(totalPago)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Restante</span>
                <span className={cn('tabular-nums font-semibold', restante > 0 ? 'text-warning' : 'text-success')}>
                  {formatCurrency(restante)}
                </span>
              </div>
              {troco > 0 && (
                <div className="flex justify-between text-lg font-bold text-warning">
                  <span>Troco</span>
                  <span className="tabular-nums">{formatCurrency(troco)}</span>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Observação</label>
              <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Opcional" />
            </div>

            <Button
              size="xl"
              variant="success"
              className="w-full h-16 text-lg"
              disabled={saving || total <= 0 || (totalPago + parseMoney(amountRaw)) < total}
              onClick={confirmSale}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              CONFIRMAR VENDA
            </Button>
            <div className="text-[10px] text-muted-foreground text-center leading-relaxed">
              <kbd className="px-1 py-0.5 bg-secondary rounded font-mono">Enter</kbd> adiciona pagamento ·{' '}
              <kbd className="px-1 py-0.5 bg-secondary rounded font-mono">Ctrl+Enter</kbd> ou{' '}
              <kbd className="px-1 py-0.5 bg-secondary rounded font-mono">F5</kbd> confirmam a venda ·{' '}
              <kbd className="px-1 py-0.5 bg-secondary rounded font-mono">1-9</kbd> escolhem a forma
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
