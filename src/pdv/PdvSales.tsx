import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Barcode, Scale, DollarSign, Search, Loader2, Clock, LockKeyhole, ArrowUpDown, History, LogOut, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UpdateBanner } from '@/components/UpdateBanner';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { usePdv } from '@/stores/pdvStore';
import { ProductGrid, type PdvProduct } from './ProductGrid';
import { CartSidebar } from './CartSidebar';
import { CashierOpenDialog } from './CashierOpenDialog';
import { CashierCloseDialog } from './CashierCloseDialog';
import { CashMovementDialog } from './CashMovementDialog';
import { QuickProductDialog } from './QuickProductDialog';
import { CategoryTabs } from './CategoryTabs';
import { TopSellersStrip } from './TopSellersStrip';
import { RecentSalesDialog } from './RecentSalesDialog';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { ClientPickerDialog } from './ClientPickerDialog';
import { CheckoutDialog } from './CheckoutDialog';
import { useAuth } from '@/stores/authStore';
import { PERMISSION_MODULES } from '@/lib/permissions';
import { usePrefs } from '@/stores/prefsStore';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';

export function PdvSales() {
  const navigate = useNavigate();
  const permissions = useAuth((s) => s.permissions);
  const logout = useAuth((s) => s.logout);
  const session = useAuth((s) => s.session);
  const idleMin = usePrefs((s) => s.pdvIdleTimeoutMin);
  // Show the "back to ERP" button only if the user has access to at least one non-PDV module
  const canAccessErp = !!permissions && PERMISSION_MODULES.filter((m) => m.key !== 'pdv').some((m) => permissions[m.key]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Idle timeout: auto-logout after N minutes of inactivity
  const idleMs = (idleMin || 0) * 60_000;
  const idleRemaining = useIdleTimeout(idleMs, () => {
    toast.warning('Sessão encerrada por inatividade');
    void handleLogout();
  }, 15_000);
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<PdvProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [cashierChecked, setCashierChecked] = useState(false);
  const [cashierOpen, setCashierOpenState] = useState(false);
  const [cashierCloseOpen, setCashierCloseOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [unknownCode, setUnknownCode] = useState<string | null>(null);
  const [categories, setCategories] = useState<Array<{ id: number; nome_tipo: string; produtos: number }>>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [topSellers, setTopSellers] = useState<PdvProduct[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const addItem = usePdv((s) => s.addItem);
  const cashierId = usePdv((s) => s.cashierId);
  const setCashierId = usePdv((s) => s.setCashierId);

  // Check open cashier on mount
  useEffect(() => {
    (async () => {
      const open = await api.pdv.getOpenCashier();
      if (open) {
        setCashierId(open.id);
      } else {
        setCashierOpenState(true);
      }
      setCashierChecked(true);
    })();
  }, [setCashierId]);

  // Load products (with optional category filter)
  const loadProducts = useCallback(async (q: string, idTipo: number | null = selectedCategory) => {
    setLoading(true);
    try {
      const ps = await api.pdv.listProducts({ search: q, limit: 60, id_tipo: idTipo });
      setProducts(ps as PdvProduct[]);
    } catch (e) {
      toast.error(`Erro ao buscar produtos: ${(e as Error).message}`);
    }
    setLoading(false);
  }, [selectedCategory]);

  useEffect(() => {
    if (!cashierId) return;
    const t = setTimeout(() => loadProducts(search, selectedCategory), 180);
    return () => clearTimeout(t);
  }, [search, cashierId, selectedCategory, loadProducts]);

  // Hardware capability flags — load once on mount so we can hide unused buttons.
  const [hwStatus, setHwStatus] = useState<{ scaleEnabled: boolean; drawerEnabled: boolean } | null>(null);
  useEffect(() => {
    void api.hardware.getStatus().then((s) => setHwStatus({ scaleEnabled: s.scaleEnabled, drawerEnabled: s.drawerEnabled }));
  }, []);

  // Keyboard multiplier: user types digits (optionally comma) then `*`, and the
  // next product added (via click, scan or code enter) is multiplied by that qty.
  const [qtyBuffer, setQtyBuffer] = useState('');
  const [pendingMultiplier, setPendingMultiplier] = useState<number | null>(null);
  const pendingMultiplierRef = useRef<number | null>(null);
  useEffect(() => {
    pendingMultiplierRef.current = pendingMultiplier;
  }, [pendingMultiplier]);
  const clearMultiplier = () => {
    setQtyBuffer('');
    setPendingMultiplier(null);
    pendingMultiplierRef.current = null;
  };
  const consumeMultiplier = (): number => {
    const q = pendingMultiplierRef.current ?? 1;
    clearMultiplier();
    return q;
  };

  // Load categories, top sellers & active promo tiers once cashier is open
  const setPromoTiers = usePdv((s) => s.setPromoTiers);
  useEffect(() => {
    if (!cashierId) return;
    void api.pdv.listCategories().then((c) => setCategories(c));
    void api.pdv.topSellers({ limit: 12, days: 30 }).then((r) => setTopSellers(r as unknown as PdvProduct[]));
    void api.pdv.listActivePromoTiers().then((t) =>
      setPromoTiers(t as unknown as { id_produto: number; quantidade_minima: number; vr_promocao: number }[])
    );
  }, [cashierId, setPromoTiers]);

  // Focus search on mount
  useEffect(() => {
    if (cashierId) searchRef.current?.focus();
  }, [cashierId]);

  // Keyboard shortcuts + multiplier capture
  const lastGlobalKeyAt = useRef(0);
  useEffect(() => {
    const anyDialogOpen =
      checkoutOpen || clientOpen || cashierOpen || cashierCloseOpen || movementOpen || recentOpen || !!unknownCode;
    const onKey = (e: KeyboardEvent) => {
      if (anyDialogOpen) return;
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      // F-key shortcuts (work everywhere)
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        if (usePdv.getState().items.length > 0) setCheckoutOpen(true);
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        setClientOpen(true);
        return;
      }

      // Multiplier capture — only when NOT typing in a field
      if (inField) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Fast bursts of keys are almost certainly a barcode scan — skip.
      const now = performance.now();
      const gap = lastGlobalKeyAt.current ? now - lastGlobalKeyAt.current : Infinity;
      lastGlobalKeyAt.current = now;
      if (gap < 50) {
        // Discard any partial qty we may have accidentally started before the scan.
        if (qtyBuffer && !pendingMultiplier) setQtyBuffer('');
        return;
      }

      if (e.key === 'Escape') {
        if (qtyBuffer || pendingMultiplier !== null) {
          e.preventDefault();
          clearMultiplier();
        }
        return;
      }
      if (e.key === 'Backspace' && qtyBuffer && pendingMultiplier === null) {
        e.preventDefault();
        setQtyBuffer((b) => b.slice(0, -1));
        return;
      }

      // Digit — build qty
      if (/^[0-9]$/.test(e.key) && pendingMultiplier === null) {
        e.preventDefault();
        setQtyBuffer((b) => (b + e.key).slice(0, 6));
        return;
      }
      // Decimal separator
      if ((e.key === ',' || e.key === '.') && qtyBuffer && !qtyBuffer.includes(',') && pendingMultiplier === null) {
        e.preventDefault();
        setQtyBuffer((b) => b + ',');
        return;
      }
      // Lock in the multiplier — Enter confirms
      if (e.key === 'Enter' && qtyBuffer && pendingMultiplier === null) {
        const n = parseFloat(qtyBuffer.replace(',', '.'));
        if (Number.isFinite(n) && n > 0) {
          e.preventDefault();
          // Update both ref (sync) and state (async) so a scan firing
          // immediately after can still read the multiplier.
          pendingMultiplierRef.current = n;
          setPendingMultiplier(n);
          setQtyBuffer('');
          toast.message(`× ${n.toLocaleString('pt-BR')}`, { duration: 1500 });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    checkoutOpen,
    clientOpen,
    cashierOpen,
    cashierCloseOpen,
    movementOpen,
    recentOpen,
    unknownCode,
    qtyBuffer,
    pendingMultiplier,
  ]);

  // Global barcode scanner — works even when the search input isn't focused.
  // Disabled while dialogs are open to avoid intercepting checkout/client search.
  const scannerDisabled = !cashierId || checkoutOpen || clientOpen || cashierOpen || cashierCloseOpen || movementOpen || recentOpen || !!unknownCode;
  useBarcodeScanner({
    disabled: scannerDisabled,
    onScan: async (code) => {
      try {
        const found = await api.pdv.findByCode(code);
        if (!found) {
          // Not registered — offer quick create
          setUnknownCode(code);
          setSearch('');
          return;
        }
        handlePickProduct(found as PdvProduct);
        toast.success(`+1 ${found.nome_produto}`, { duration: 1500 });
        setSearch('');
      } catch (e) {
        toast.error((e as Error).message);
      }
    },
  });

  const handlePickProduct = (p: PdvProduct, qty?: number) => {
    if ((p.vr_venda ?? 0) <= 0) {
      toast.error('Produto sem preço de venda');
      return;
    }
    // If caller didn't pass a qty, consume any pending keyboard multiplier
    const finalQty = qty ?? consumeMultiplier();
    const base = p.vr_venda ?? 0;
    addItem({
      id_produto: p.id,
      nome_produto: p.nome_produto,
      valor: base,
      valor_base: base,
      quant: finalQty,
      unidade: p.unidade ?? undefined,
      fracionado: !!p.fracionado,
    });
    setSearch('');
    // Blur the search input so subsequent digit keys reach the global
    // multiplier handler instead of typing into the box. Press F2 to focus.
    searchRef.current?.blur();
  };

  // Parse "12*7894900010015" / "12x7894..." / "12,5*BALANCA" — quantity multiplier before a code.
  const parseQtyMultiplier = (raw: string): { qty: number; code: string } | null => {
    const m = raw.match(/^(\d+(?:[.,]\d+)?)\s*[*xX]\s*(.+)$/);
    if (!m) return null;
    const qty = parseFloat(m[1].replace(',', '.'));
    const code = m[2].trim();
    if (!Number.isFinite(qty) || qty <= 0 || !code) return null;
    return { qty, code };
  };

  const handleSearchEnter = async () => {
    const q = search.trim();
    if (!q) return;

    // Bare number (max 4 digits, or with decimal) — treat as multiplier lock-in.
    // Longer numeric strings are treated as barcodes.
    if (/^\d{1,4}(?:[.,]\d+)?$/.test(q) && pendingMultiplier === null) {
      const n = parseFloat(q.replace(',', '.'));
      if (Number.isFinite(n) && n > 0) {
        pendingMultiplierRef.current = n;
        setPendingMultiplier(n);
        setQtyBuffer('');
        setSearch('');
        searchRef.current?.blur();
        toast.message(`× ${n.toLocaleString('pt-BR')}`, { duration: 1500 });
        return;
      }
    }

    // Legacy "12*7894..." format still supported for typed-in-line entries
    const mult = parseQtyMultiplier(q);
    if (mult) {
      const found = await api.pdv.findByCode(mult.code);
      if (found) {
        handlePickProduct(found as PdvProduct, mult.qty);
        return;
      }
      if (/^\d{4,}$/.test(mult.code)) {
        setUnknownCode(mult.code);
        setSearch('');
      } else {
        toast.error('Produto não encontrado para o código informado');
      }
      return;
    }

    const found = await api.pdv.findByCode(q);
    if (found) {
      handlePickProduct(found as PdvProduct);
      return;
    }
    // If it looks like a barcode (all digits, length >= 4), offer to register
    if (/^\d{4,}$/.test(q)) {
      setUnknownCode(q);
      setSearch('');
    }
  };

  const handleReadScale = async () => {
    const r = await api.hardware.readScale();
    if (!r.ok) {
      toast.error(r.error ?? 'Falha na leitura da balança');
      return;
    }
    const weight = r.weight ?? 0;
    toast.success(`Peso lido: ${weight.toFixed(3)} kg`);
    // If there's a product currently searched/selected, add with weight
    if (search.trim()) {
      const found = await api.pdv.findByCode(search.trim());
      if (found) {
        {
          const base = found.vr_venda ?? 0;
          addItem({
            id_produto: found.id,
            nome_produto: found.nome_produto,
            valor: base,
            valor_base: base,
            quant: weight,
            unidade: found.unidade ?? 'KG',
            fracionado: true,
          });
        }
        setSearch('');
        return;
      }
    }
    toast.message('Selecione um produto e clique novamente na balança para adicionar por peso');
  };

  const handleOpenDrawer = async () => {
    const r = await api.printer.openDrawer();
    if (!r.ok) toast.error(r.error ?? 'Falha ao abrir gaveta');
  };

  if (!cashierChecked) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background">
      <CashierOpenDialog
        open={cashierOpen && !cashierId}
        onOpened={(id) => {
          setCashierId(id);
          setCashierOpenState(false);
        }}
      />

      <ClientPickerDialog open={clientOpen} onOpenChange={setClientOpen} />
      <RecentSalesDialog open={recentOpen} onOpenChange={setRecentOpen} />

      {unknownCode && (
        <QuickProductDialog
          scannedCode={unknownCode}
          onClose={() => setUnknownCode(null)}
          onCreated={(product) => {
            setUnknownCode(null);
            handlePickProduct(product as PdvProduct);
            toast.success(`${product.nome_produto} adicionado ao carrinho`);
            void loadProducts(search);
          }}
        />
      )}

      {cashierId && (
        <>
          <CashierCloseDialog
            open={cashierCloseOpen}
            cashierId={cashierId}
            onOpenChange={setCashierCloseOpen}
            onClosed={() => {
              setCashierCloseOpen(false);
              navigate('/erp');
            }}
          />
          <CashMovementDialog open={movementOpen} cashierId={cashierId} onOpenChange={setMovementOpen} />
        </>
      )}
      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        onComplete={() => {
          setCheckoutOpen(false);
          void loadProducts(search, selectedCategory);
          void api.pdv.topSellers({ limit: 12, days: 30 }).then((r) => setTopSellers(r as unknown as PdvProduct[]));
        }}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-white/5 flex items-center px-6 gap-4 bg-black/20">
          {canAccessErp ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/erp')}>
                <ArrowLeft className="w-4 h-4" /> ERP
              </Button>
              <div className="h-6 w-px bg-white/10" />
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4" /> Sair
              </Button>
              {session && (
                <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{session.login}</span>
                </div>
              )}
              <div className="h-6 w-px bg-white/10" />
            </>
          )}
          {idleRemaining > 0 && (
            <div className="flex items-center gap-1 text-xs text-warning bg-warning/10 border border-warning/30 rounded-full px-3 py-1 animate-pulse">
              <Clock className="w-3 h-3" /> Logout em {idleRemaining}s
            </div>
          )}
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-success" />
            <span className="text-sm">Caixa aberto</span>
            {cashierId && <span className="text-xs text-muted-foreground">#{cashierId}</span>}
          </div>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Terminal 01</span>
          </div>
          <div className="flex-1" />
          <div className="text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-secondary rounded font-mono">F2</kbd> busca ·{' '}
            <kbd className="px-1.5 py-0.5 bg-secondary rounded font-mono">F4</kbd> finalizar ·{' '}
            <kbd className="px-1.5 py-0.5 bg-secondary rounded font-mono">F8</kbd> cliente
          </div>
          <Button variant="outline" size="sm" onClick={() => setRecentOpen(true)}>
            <History className="w-4 h-4" /> Últimas vendas
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMovementOpen(true)}>
            <ArrowUpDown className="w-4 h-4" /> Sangria / Suprimento
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCashierCloseOpen(true)}>
            <LockKeyhole className="w-4 h-4" /> Fechar caixa
          </Button>
        </header>

        <div className="p-4 border-b border-white/5 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSearchEnter();
                // Escape while typing cancels a pending multiplier
                if (e.key === 'Escape' && (pendingMultiplier !== null || qtyBuffer)) {
                  e.preventDefault();
                  clearMultiplier();
                }
              }}
              placeholder="Código de barras, nome ou apenas o número + Enter para multiplicar"
              className="pl-12 h-14 text-lg"
            />
            {(qtyBuffer || pendingMultiplier !== null) && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {pendingMultiplier !== null ? (
                  <button
                    type="button"
                    onClick={clearMultiplier}
                    title="Clique para cancelar (ou pressione Esc)"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/20 text-warning hover:bg-warning/30 transition text-sm font-bold tabular-nums"
                  >
                    × {pendingMultiplier.toLocaleString('pt-BR')}
                    <span className="text-[10px] font-normal text-warning/70">próximo produto</span>
                    <X className="w-3.5 h-3.5 opacity-70" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={clearMultiplier}
                    title="Enter confirma · Esc cancela"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition text-sm font-bold tabular-nums"
                  >
                    {qtyBuffer}
                    <span className="text-[10px] font-normal text-primary/70">Enter p/ multiplicar</span>
                    <X className="w-3.5 h-3.5 opacity-70" />
                  </button>
                )}
              </div>
            )}
          </div>
          {hwStatus?.scaleEnabled && (
            <Button size="lg" variant="outline" onClick={handleReadScale}>
              <Scale className="w-5 h-5" /> Balança
            </Button>
          )}
          {hwStatus?.drawerEnabled && (
            <Button size="lg" variant="outline" onClick={handleOpenDrawer}>
              <DollarSign className="w-5 h-5" /> Gaveta
            </Button>
          )}
          <Button size="lg" variant="outline" onClick={() => searchRef.current?.focus()}>
            <Barcode className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <CategoryTabs categories={categories.filter((c) => c.produtos > 0)} selected={selectedCategory} onSelect={setSelectedCategory} />

          {selectedCategory === null && !search.trim() && topSellers.length > 0 && (
            <TopSellersStrip products={topSellers} onSelect={handlePickProduct} />
          )}

          {loading && products.length === 0 ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <ProductGrid products={products} onSelect={handlePickProduct} />
          )}
        </div>
      </main>

      <CartSidebar onCheckout={() => setCheckoutOpen(true)} onSelectClient={() => setClientOpen(true)} />
      <UpdateBanner />
    </div>
  );
}
