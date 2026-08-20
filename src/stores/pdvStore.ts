import { create } from 'zustand';

export type CartItem = {
  id_produto: number;
  nome_produto: string;
  valor: number;
  valor_base: number; // preço original do produto — usado p/ voltar quando qty cai abaixo do tier
  quant: number;
  unidade?: string;
  fracionado?: boolean;
  promo_qty_min?: number; // se preenchido, indica que o valor atual veio de uma promoção com essa qtd mínima
};

export type PromoTier = {
  id_produto: number;
  quantidade_minima: number;
  vr_promocao: number;
};

export type Payment = {
  cod_lancamento: number;
  label: string;
  valor: number;
};

export type ClientRef = {
  id: number;
  nome_cliente: string;
  cpf_cnpj?: string | null;
};

type PdvState = {
  items: CartItem[];
  payments: Payment[];
  desconto: number;
  cliente: ClientRef | null;
  observacao: string;

  cashierId: number | null;

  promoTiers: PromoTier[];
  setPromoTiers: (tiers: PromoTier[]) => void;

  addItem: (item: CartItem) => void;
  increment: (idx: number, by?: number) => void;
  setQuant: (idx: number, quant: number) => void;
  setValor: (idx: number, valor: number) => void;
  removeItem: (idx: number) => void;
  setDesconto: (v: number) => void;
  setCliente: (c: ClientRef | null) => void;
  setObservacao: (o: string) => void;
  setPayments: (payments: Payment[]) => void;
  clear: () => void;
  setCashierId: (id: number | null) => void;

  subtotal: () => number;
  total: () => number;
  totalPago: () => number;
  troco: () => number;
};

/**
 * Resolve the effective unit price for a product at a given quantity.
 * Picks the promo tier with the highest quantidade_minima that is <= qty
 * AND whose price beats the base — falls back to base otherwise.
 */
function resolvePrice(
  id_produto: number,
  qty: number,
  valor_base: number,
  tiers: PromoTier[]
): { valor: number; promo_qty_min?: number } {
  const applicable = tiers
    .filter((t) => t.id_produto === id_produto && qty >= t.quantidade_minima && t.vr_promocao > 0)
    .sort((a, b) => b.quantidade_minima - a.quantidade_minima); // prefer higher tier
  const best = applicable.find((t) => t.vr_promocao < valor_base) ?? applicable[0];
  if (best) return { valor: best.vr_promocao, promo_qty_min: best.quantidade_minima };
  return { valor: valor_base };
}

function reprice(item: CartItem, tiers: PromoTier[]): CartItem {
  const { valor, promo_qty_min } = resolvePrice(item.id_produto, item.quant, item.valor_base, tiers);
  return { ...item, valor, promo_qty_min };
}

export const usePdv = create<PdvState>((set, get) => ({
  items: [],
  payments: [],
  desconto: 0,
  cliente: null,
  observacao: '',
  cashierId: null,
  promoTiers: [],

  setPromoTiers: (tiers) =>
    set((s) => ({
      promoTiers: tiers,
      // Also re-price whatever is already in the cart against the fresh tier data
      items: s.items.map((it) => reprice(it, tiers)),
    })),

  addItem: (item) =>
    set((s) => {
      const withBase: CartItem = {
        ...item,
        valor_base: item.valor_base ?? item.valor,
      };
      const existingIdx = s.items.findIndex((i) => i.id_produto === item.id_produto && !i.fracionado);
      if (existingIdx >= 0 && !item.fracionado) {
        const next = [...s.items];
        const merged = { ...next[existingIdx], quant: next[existingIdx].quant + item.quant };
        next[existingIdx] = reprice(merged, s.promoTiers);
        return { items: next };
      }
      return { items: [...s.items, reprice(withBase, s.promoTiers)] };
    }),

  increment: (idx, by = 1) =>
    set((s) => {
      const next = [...s.items];
      if (!next[idx]) return s;
      const q = Math.max(0, next[idx].quant + by);
      if (q === 0) {
        next.splice(idx, 1);
      } else {
        next[idx] = reprice({ ...next[idx], quant: q }, s.promoTiers);
      }
      return { items: next };
    }),

  setQuant: (idx, quant) =>
    set((s) => {
      const next = [...s.items];
      if (!next[idx]) return s;
      next[idx] = reprice({ ...next[idx], quant }, s.promoTiers);
      return { items: next };
    }),

  setValor: (idx, valor) =>
    set((s) => {
      const next = [...s.items];
      if (!next[idx]) return s;
      // Manual override — keep valor_base intact but clear promo marker.
      next[idx] = { ...next[idx], valor: Math.max(0, valor), promo_qty_min: undefined };
      return { items: next };
    }),

  removeItem: (idx) => set((s) => ({ items: s.items.filter((_, i) => i !== idx) })),

  setDesconto: (v) => set(() => ({ desconto: Math.max(0, v) })),
  setCliente: (c) => set(() => ({ cliente: c })),
  setObservacao: (o) => set(() => ({ observacao: o })),
  setPayments: (payments) => set(() => ({ payments })),

  clear: () => set(() => ({ items: [], payments: [], desconto: 0, cliente: null, observacao: '' })),

  setCashierId: (id) => set(() => ({ cashierId: id })),

  subtotal: () => get().items.reduce((s, i) => s + i.valor * i.quant, 0),
  total: () => Math.max(0, get().subtotal() - get().desconto),
  totalPago: () => get().payments.reduce((s, p) => s + p.valor, 0),
  troco: () => Math.max(0, get().totalPago() - get().total()),
}));
