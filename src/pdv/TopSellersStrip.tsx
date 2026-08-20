import { motion } from 'framer-motion';
import { Flame, Package } from 'lucide-react';
import type { PdvProduct } from './ProductGrid';
import { formatCurrency } from '@/lib/utils';

export function TopSellersStrip({ products, onSelect }: { products: PdvProduct[]; onSelect: (p: PdvProduct) => void }) {
  if (products.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <div className="w-6 h-6 rounded-md bg-warning/20 flex items-center justify-center">
          <Flame className="w-3.5 h-3.5 text-warning" />
        </div>
        <span className="font-semibold">Mais vendidos</span>
        <span className="text-xs text-muted-foreground">últimos 30 dias</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
        {products.map((p, i) => (
          <motion.button
            key={p.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect(p)}
            className="flex-shrink-0 w-[180px] p-3 rounded-xl bg-gradient-to-br from-warning/10 to-transparent border border-warning/30 hover:border-warning/60 transition-all text-left flex flex-col gap-1 touch-target"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-warning/20 flex items-center justify-center">
                <Package className="w-4 h-4 text-warning" />
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/20 text-warning font-bold">
                #{i + 1}
              </span>
            </div>
            <div className="font-semibold text-sm line-clamp-2 leading-tight mt-1">{p.nome_produto}</div>
            <div className="mt-auto pt-1 flex items-end justify-between">
              <div className="text-base font-bold text-warning tabular-nums">{formatCurrency(p.vr_venda ?? 0)}</div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
