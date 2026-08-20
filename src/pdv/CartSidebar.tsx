import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, Pencil, ShoppingCart, Sparkles, Trash2, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePdv } from '@/stores/pdvStore';
import { cn, formatCurrency } from '@/lib/utils';
import { CartItemEditDialog } from './CartItemEditDialog';

export function CartSidebar({
  onCheckout,
  onSelectClient,
}: {
  onCheckout: () => void;
  onSelectClient: () => void;
}) {
  const items = usePdv((s) => s.items);
  const cliente = usePdv((s) => s.cliente);
  const desconto = usePdv((s) => s.desconto);
  const increment = usePdv((s) => s.increment);
  const removeItem = usePdv((s) => s.removeItem);
  const clear = usePdv((s) => s.clear);
  const setCliente = usePdv((s) => s.setCliente);
  const subtotal = usePdv((s) => s.subtotal());
  const total = usePdv((s) => s.total());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const empty = items.length === 0;

  return (
    <aside className="w-[420px] flex-shrink-0 border-l border-white/5 bg-black/20 flex flex-col">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Carrinho</h2>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
        {!empty && (
          <Button variant="ghost" size="sm" onClick={clear}>
            <Trash2 className="w-4 h-4" /> Limpar
          </Button>
        )}
      </div>

      <button
        onClick={() => (cliente ? setCliente(null) : onSelectClient())}
        className={cn(
          'flex items-center gap-3 mx-4 mt-3 p-3 rounded-lg border transition-colors touch-target',
          cliente ? 'bg-primary/10 border-primary/30' : 'bg-secondary/50 border-white/5 hover:border-white/20'
        )}
      >
        <User className="w-4 h-4 text-primary" />
        <div className="text-left flex-1 min-w-0">
          {cliente ? (
            <>
              <div className="text-sm font-medium truncate">{cliente.nome_cliente}</div>
              {cliente.cpf_cnpj && <div className="text-xs text-muted-foreground">{cliente.cpf_cnpj}</div>}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Cliente / CPF na nota (opcional)</div>
          )}
        </div>
        {cliente && <X className="w-4 h-4 text-muted-foreground" />}
      </button>

      <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
        {empty && (
          <div className="text-center text-muted-foreground text-sm py-16">
            <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
            Adicione produtos ao carrinho
          </div>
        )}
        <AnimatePresence initial={false}>
          {items.map((it, idx) => (
            <motion.div
              key={`${it.id_produto}-${idx}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-3 rounded-xl bg-card border border-white/5 hover:border-primary/30 transition-colors cursor-pointer group"
              onClick={() => setEditingIndex(idx)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-1.5">
                    {it.nome_produto}
                    {it.promo_qty_min && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-warning/20 text-warning">
                        <Sparkles className="w-2.5 h-2.5" />
                        {it.promo_qty_min > 1 ? `${it.promo_qty_min}+` : 'PROMO'}
                      </span>
                    )}
                    <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {it.promo_qty_min && it.valor_base > it.valor ? (
                      <>
                        <span className="line-through mr-1">{formatCurrency(it.valor_base)}</span>
                        <span className="text-warning font-semibold">{formatCurrency(it.valor)}</span>
                      </>
                    ) : (
                      formatCurrency(it.valor)
                    )}
                    {' '}/ {it.unidade ?? 'UN'}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeItem(idx); }}
                  className="text-muted-foreground hover:text-destructive transition p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => increment(idx, -1)}
                    className="w-9 h-9 rounded-lg bg-secondary hover:bg-secondary/70 active:scale-95 flex items-center justify-center transition touch-target"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="w-14 text-center font-semibold tabular-nums">{it.quant.toLocaleString('pt-BR')}</div>
                  <button
                    onClick={() => increment(idx, 1)}
                    className="w-9 h-9 rounded-lg bg-secondary hover:bg-secondary/70 active:scale-95 flex items-center justify-center transition touch-target"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="font-bold tabular-nums">{formatCurrency(it.valor * it.quant)}</div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {editingIndex !== null && (
          <CartItemEditDialog index={editingIndex} onClose={() => setEditingIndex(null)} />
        )}
      </div>

      <div className="p-4 border-t border-white/5 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{formatCurrency(subtotal)}</span>
        </div>
        {desconto > 0 && (
          <div className="flex justify-between text-sm text-warning">
            <span>Desconto</span>
            <span className="tabular-nums">- {formatCurrency(desconto)}</span>
          </div>
        )}
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-3xl font-bold tabular-nums text-success">{formatCurrency(total)}</span>
        </div>
        <Button
          size="xl"
          variant="success"
          className="w-full h-16 text-xl"
          disabled={empty}
          onClick={onCheckout}
        >
          FINALIZAR VENDA
        </Button>
      </div>
    </aside>
  );
}
