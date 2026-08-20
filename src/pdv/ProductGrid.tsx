import { motion } from 'framer-motion';
import { Package, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export type PdvProduct = {
  id: number;
  nome_produto: string;
  cod_barra: string | null;
  unidade: string | null;
  vr_venda: number | null;
  vr_venda_original?: number | null;
  em_promocao?: boolean;
  estoque: number | null;
  fracionado: number | null;
};

export function ProductGrid({ products, onSelect }: { products: PdvProduct[]; onSelect: (p: PdvProduct) => void }) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Package className="w-12 h-12 mb-2 opacity-30" />
        <p className="text-sm">Nenhum produto encontrado</p>
        <p className="text-xs mt-1">Cadastre produtos no ERP ou use o campo de busca</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
      {products.map((p, i) => (
        <motion.button
          key={p.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.015, 0.4) }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onSelect(p)}
          className="text-left p-4 rounded-xl bg-card border border-white/5 hover:border-primary/40 active:border-primary transition-all touch-target flex flex-col gap-1"
        >
          <div className="flex items-start justify-between">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4 text-primary" />
            </div>
            <div className="flex flex-col items-end gap-1">
              {p.em_promocao && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-warning/20 text-warning">
                  <Sparkles className="w-2.5 h-2.5" /> PROMO
                </span>
              )}
              {p.fracionado ? (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/20 text-primary">PESO</span>
              ) : null}
            </div>
          </div>
          <div className="mt-2 font-semibold line-clamp-2 text-sm leading-tight">{p.nome_produto}</div>
          {p.cod_barra && <div className="text-[10px] text-muted-foreground font-mono">{p.cod_barra}</div>}
          <div className="mt-auto pt-2 flex items-end justify-between">
            <div>
              {p.em_promocao && p.vr_venda_original ? (
                <div className="text-[10px] text-muted-foreground line-through tabular-nums">
                  {formatCurrency(p.vr_venda_original)}
                </div>
              ) : null}
              <div className={`text-lg font-bold tabular-nums ${p.em_promocao ? 'text-warning' : 'text-primary'}`}>
                {formatCurrency(p.vr_venda ?? 0)}
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground">Est: {(p.estoque ?? 0).toFixed(0)}</div>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
