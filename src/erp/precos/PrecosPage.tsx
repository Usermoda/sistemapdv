import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowUp, Calendar, Check, DollarSign, Filter, Loader2, Percent, Plus, Power, PowerOff, Search, Sparkles, Tag, Trash2, TrendingUp, X } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FormField } from '@/components/FormField';
import { api } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

type PriceRow = {
  id: number;
  nome_produto: string;
  cod_barra: string | null;
  unidade: string | null;
  vr_compra: number | null;
  vr_venda: number | null;
  vr_venda_2: number | null;
  estoque: number | null;
  id_tipo: number | null;
  nome_tipo: string | null;
  vr_promocao_ativo: number | null;
  promocao_qty_min: number | null;
  promocao_data_fim: string | null;
};

type Promotion = {
  id: number;
  id_produto: number;
  descricao: string | null;
  vr_promocao: number;
  quantidade_minima: number;
  data_inicio: string;
  data_fim: string | null;
  inativo: number;
  nome_produto: string | null;
  cod_barra: string | null;
  vr_venda_original: number | null;
};

export function PrecosPage() {
  const [tab, setTab] = useState<'precos' | 'promocoes'>('precos');

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Preços e promoções"
        description="Edição rápida de preços em massa, ajuste por margem e campanhas promocionais"
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="precos"><DollarSign className="w-4 h-4 mr-1" /> Preços</TabsTrigger>
          <TabsTrigger value="promocoes"><Sparkles className="w-4 h-4 mr-1" /> Promoções</TabsTrigger>
        </TabsList>

        <TabsContent value="precos" className="mt-4">
          <PrecosTab />
        </TabsContent>
        <TabsContent value="promocoes" className="mt-4">
          <PromocoesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================================================
 * Preços — bulk edit
 * ============================================================ */
function PrecosTab() {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyLowMargin, setOnlyLowMargin] = useState(false);
  const [category, setCategory] = useState<string>('all');
  const [categories, setCategories] = useState<Array<{ id: number; nome_tipo: string }>>([]);
  const [drafts, setDrafts] = useState<Record<number, { vr_venda?: number; vr_compra?: number; vr_venda_2?: number }>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [markupDialogOpen, setMarkupDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.erp.prices.list({
        search,
        id_tipo: category === 'all' ? null : Number(category),
        onlyLowMargin,
        limit: 500,
      });
      setRows(r as PriceRow[]);
      setDrafts({});
      setSelectedIds(new Set());
    } catch (e) {
      toast.error((e as Error).message);
    }
    setLoading(false);
  }, [search, category, onlyLowMargin]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api.erp.products.categories().then(setCategories);
  }, []);

  const setDraft = (id: number, field: 'vr_venda' | 'vr_compra' | 'vr_venda_2', value: number) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === rows.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(rows.map((r) => r.id)));
  };

  const changesCount = Object.keys(drafts).length;

  const saveAll = async () => {
    if (changesCount === 0) return;
    const updates = Object.entries(drafts).map(([id, patch]) => ({ id: Number(id), ...patch }));
    setSaving(true);
    try {
      const r = await api.erp.prices.bulkUpdate(updates);
      toast.success(`${r.count} produtos atualizados`);
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };

  const marginPercent = (r: PriceRow, draft: { vr_venda?: number; vr_compra?: number } = {}): number | null => {
    const compra = draft.vr_compra ?? Number(r.vr_compra ?? 0);
    const venda = draft.vr_venda ?? Number(r.vr_venda ?? 0);
    if (compra <= 0) return null;
    return ((venda - compra) / compra) * 100;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Buscar</label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Nome, código de barras..." />
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Categoria</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="mt-1 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nome_tipo}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant={onlyLowMargin ? 'default' : 'outline'}
          onClick={() => setOnlyLowMargin((v) => !v)}
        >
          <Filter className="w-4 h-4" /> Margem baixa (&lt; 20%)
        </Button>
      </div>

      <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-white/5">
        <div className="text-sm">
          <span className="font-semibold">{rows.length}</span> produtos ·{' '}
          {selectedIds.size > 0 && (
            <span className="text-primary font-semibold">{selectedIds.size} selecionados · </span>
          )}
          {changesCount > 0 && (
            <span className="text-warning font-semibold">{changesCount} alterações pendentes</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setMarkupDialogOpen(true)} disabled={selectedIds.size === 0}>
            <TrendingUp className="w-4 h-4" /> Aplicar markup em {selectedIds.size || '...'}
          </Button>
          <Button onClick={saveAll} disabled={changesCount === 0 || saving} variant="success">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Salvar {changesCount > 0 && `(${changesCount})`}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-black/20 text-xs uppercase text-muted-foreground">
              <th className="w-10 px-2 py-2">
                <input
                  type="checkbox"
                  checked={selectedIds.size === rows.length && rows.length > 0}
                  onChange={toggleAll}
                  className="cursor-pointer"
                />
              </th>
              <th className="text-left px-3 py-2">Produto</th>
              <th className="text-right px-3 py-2 w-32">Compra</th>
              <th className="text-right px-3 py-2 w-32">Venda</th>
              <th className="text-right px-3 py-2 w-24">Margem</th>
              <th className="text-right px-3 py-2 w-32">Atacado</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Nenhum produto encontrado</td></tr>
            )}
            {!loading && rows.map((r) => {
              const draft = drafts[r.id] ?? {};
              const isEdited = !!drafts[r.id];
              const margin = marginPercent(r, draft);
              const marginClass = margin === null ? 'text-muted-foreground' : margin < 20 ? 'text-warning' : margin < 40 ? 'text-foreground' : 'text-success';
              return (
                <tr key={r.id} className={cn('border-t border-white/5', isEdited && 'bg-warning/5')}>
                  <td className="px-2 py-2 text-center">
                    <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} className="cursor-pointer" />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-medium">{r.nome_produto}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.cod_barra ?? 'sem código'} · {r.nome_tipo ?? 'sem categoria'}
                          {r.vr_promocao_ativo !== null && (
                            <span className="ml-2 inline-flex items-center gap-1 text-warning">
                              <Sparkles className="w-3 h-3" />
                              Em promoção
                              {r.promocao_qty_min && r.promocao_qty_min > 1 ? ` a partir de ${r.promocao_qty_min}un` : ''}
                              : {formatCurrency(Number(r.vr_promocao_ativo))}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={draft.vr_compra ?? r.vr_compra ?? 0}
                      onChange={(e) => setDraft(r.id, 'vr_compra', Number(e.target.value))}
                      className="h-8 text-right tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={draft.vr_venda ?? r.vr_venda ?? 0}
                      onChange={(e) => setDraft(r.id, 'vr_venda', Number(e.target.value))}
                      className={cn('h-8 text-right tabular-nums font-semibold', isEdited && 'border-warning')}
                    />
                  </td>
                  <td className={cn('px-3 py-2 text-right tabular-nums font-semibold', marginClass)}>
                    {margin === null ? '—' : `${margin.toFixed(1)}%`}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={draft.vr_venda_2 ?? r.vr_venda_2 ?? 0}
                      onChange={(e) => setDraft(r.id, 'vr_venda_2', Number(e.target.value))}
                      className="h-8 text-right tabular-nums"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {markupDialogOpen && (
        <MarkupDialog
          selectedIds={Array.from(selectedIds)}
          onClose={() => setMarkupDialogOpen(false)}
          onApplied={() => {
            setMarkupDialogOpen(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function MarkupDialog({
  selectedIds,
  onClose,
  onApplied,
}: {
  selectedIds: number[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const [markup, setMarkup] = useState(30);
  const [base, setBase] = useState<'compra' | 'venda'>('compra');
  const [applying, setApplying] = useState(false);

  const apply = async () => {
    setApplying(true);
    try {
      const r = await api.erp.prices.applyMarkup({ productIds: selectedIds, markupPercent: markup, base });
      toast.success(`Markup aplicado em ${r.count} produtos`);
      onApplied();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setApplying(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aplicar markup em massa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-primary/10 border border-primary/30 p-3 text-sm">
            {selectedIds.length} produtos selecionados. O novo preço de venda será calculado como <strong>{base === 'compra' ? 'custo' : 'preço atual'} × (1 + markup%)</strong>.
          </div>
          <FormField label="Markup (%)">
            <div className="relative">
              <Input type="number" value={markup} onChange={(e) => setMarkup(Number(e.target.value) || 0)} className="pr-8" />
              <Percent className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            </div>
          </FormField>
          <FormField label="Aplicar sobre">
            <Select value={base} onValueChange={(v) => setBase(v as 'compra' | 'venda')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="compra">Preço de compra (custo)</SelectItem>
                <SelectItem value="venda">Preço de venda atual (reajuste)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <div className="text-xs text-muted-foreground">
            Ex.: custo R$ 10,00 com markup {markup}% → venda R$ {(10 * (1 + markup / 100)).toFixed(2).replace('.', ',')}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={apply} disabled={applying}>
            {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 * Promoções
 * ============================================================ */
type PromoStatus = 'active' | 'scheduled' | 'expired' | 'all';

function PromocoesTab() {
  const [rows, setRows] = useState<Promotion[]>([]);
  const [status, setStatus] = useState<PromoStatus>('all');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.erp.promotions.list({ status });
      setRows(r as unknown as Promotion[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setLoading(false);
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const promoStatus = (p: Promotion): 'active' | 'scheduled' | 'expired' | 'paused' => {
    if (p.inativo) return 'paused';
    if (p.data_inicio > today) return 'scheduled';
    if (p.data_fim && p.data_fim < today) return 'expired';
    return 'active';
  };

  const toggle = async (p: Promotion) => {
    try {
      await api.erp.promotions.toggle(p.id, !p.inativo);
      void load();
    } catch (e) { toast.error((e as Error).message); }
  };

  const remove = async (p: Promotion) => {
    if (!confirm('Remover esta promoção?')) return;
    try {
      await api.erp.promotions.delete(p.id);
      toast.success('Removida');
      void load();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Filtro</label>
          <Select value={status} onValueChange={(v) => setStatus(v as PromoStatus)}>
            <SelectTrigger className="mt-1 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="active">Ativas agora</SelectItem>
              <SelectItem value="scheduled">Agendadas</SelectItem>
              <SelectItem value="expired">Expiradas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="w-4 h-4" /> Nova promoção</Button>
      </div>

      <div className="rounded-xl border border-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-black/20 text-xs uppercase text-muted-foreground">
              <th className="text-left px-3 py-2">Produto</th>
              <th className="text-left px-3 py-2 w-48">Descrição</th>
              <th className="text-right px-3 py-2">De</th>
              <th className="text-right px-3 py-2">Por</th>
              <th className="text-center px-3 py-2">Desconto</th>
              <th className="text-center px-3 py-2 w-24">A partir de</th>
              <th className="text-center px-3 py-2 w-32">Período</th>
              <th className="text-center px-3 py-2 w-28">Status</th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="text-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">
                <Sparkles className="w-10 h-10 opacity-30 mx-auto mb-2" />
                Nenhuma promoção. Crie a primeira!
              </td></tr>
            )}
            {rows.map((p) => {
              const st = promoStatus(p);
              const original = Number(p.vr_venda_original ?? 0);
              const desconto = original > 0 ? ((original - p.vr_promocao) / original) * 100 : 0;
              return (
                <tr key={p.id} className={cn('border-t border-white/5', st === 'expired' && 'opacity-50')}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-primary flex-shrink-0" />
                      <div>
                        <div className="font-medium">{p.nome_produto}</div>
                        {p.cod_barra && <div className="text-[10px] font-mono text-muted-foreground">{p.cod_barra}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs">{p.descricao ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums line-through text-muted-foreground">{formatCurrency(original)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-success">{formatCurrency(Number(p.vr_promocao))}</td>
                  <td className="px-3 py-2 text-center">
                    {desconto > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-warning/20 text-warning text-xs font-bold">
                        -{desconto.toFixed(0)}%
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {p.quantidade_minima > 1 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                        {p.quantidade_minima}+ un
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">1 un</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center text-xs">
                    <div>{new Date(p.data_inicio).toLocaleDateString('pt-BR')}</div>
                    <div className="text-muted-foreground">
                      {p.data_fim ? `até ${new Date(p.data_fim).toLocaleDateString('pt-BR')}` : 'sem fim'}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {st === 'active' && <span className="text-xs text-success font-semibold">● Ativa</span>}
                    {st === 'scheduled' && <span className="text-xs text-primary font-semibold">◐ Agendada</span>}
                    {st === 'expired' && <span className="text-xs text-muted-foreground">○ Expirada</span>}
                    {st === 'paused' && <span className="text-xs text-warning">⏸ Pausada</span>}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Button variant="ghost" size="icon" onClick={() => toggle(p)} title={p.inativo ? 'Ativar' : 'Pausar'}>
                      {p.inativo ? <PowerOff className="w-4 h-4 text-muted-foreground" /> : <Power className="w-4 h-4 text-success" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(p)} title="Remover">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {creating && <PromotionFormDialog onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void load(); }} />}
    </div>
  );
}

type PromoProduct = { id: number; nome_produto: string; vr_venda: number | null; cod_barra: string | null };
type PromoLine = {
  id_produto: number;
  nome_produto: string;
  vr_venda_original: number;
  vr_promocao: number;
  quantidade_minima: number;
};

function PromotionFormDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<PromoProduct[]>([]);
  const [lines, setLines] = useState<PromoLine[]>([]);
  const [descricao, setDescricao] = useState('');
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState('');
  const [saving, setSaving] = useState(false);
  // Quick-fill controls that write into the lines
  const [fillDiscount, setFillDiscount] = useState(10);
  const [fillFixed, setFillFixed] = useState(0);
  const [fillMinQty, setFillMinQty] = useState(1);

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await api.erp.products.list({ search: productSearch, limit: 30 });
      setProducts(r.rows as unknown as PromoProduct[]);
    }, 200);
    return () => clearTimeout(t);
  }, [productSearch]);

  const isSelected = (id: number) => lines.some((l) => l.id_produto === id);

  const toggle = (p: PromoProduct) => {
    setLines((prev) => {
      if (prev.some((l) => l.id_produto === p.id)) {
        return prev.filter((l) => l.id_produto !== p.id);
      }
      const original = Number(p.vr_venda ?? 0);
      return [
        ...prev,
        {
          id_produto: p.id,
          nome_produto: p.nome_produto,
          vr_venda_original: original,
          vr_promocao: +(original * 0.9).toFixed(2),
          quantidade_minima: 1,
        },
      ];
    });
  };

  const updateLine = (id_produto: number, patch: Partial<PromoLine>) => {
    setLines((prev) => prev.map((l) => (l.id_produto === id_produto ? { ...l, ...patch } : l)));
  };

  const removeLine = (id_produto: number) => {
    setLines((prev) => prev.filter((l) => l.id_produto !== id_produto));
  };

  const applyDiscountToAll = () => {
    if (fillDiscount <= 0) return toast.error('Informe o desconto');
    setLines((prev) =>
      prev.map((l) => ({ ...l, vr_promocao: +(l.vr_venda_original * (1 - fillDiscount / 100)).toFixed(2) }))
    );
  };

  const applyFixedToAll = () => {
    if (fillFixed <= 0) return toast.error('Informe o preço');
    setLines((prev) => prev.map((l) => ({ ...l, vr_promocao: fillFixed })));
  };

  const applyMinQtyToAll = () => {
    const q = Math.max(1, Math.floor(fillMinQty));
    setLines((prev) => prev.map((l) => ({ ...l, quantidade_minima: q })));
  };

  const save = async () => {
    if (lines.length === 0) return toast.error('Adicione ao menos um produto');
    if (!dataInicio) return toast.error('Informe a data de início');
    const invalid = lines.find((l) => l.vr_promocao <= 0);
    if (invalid) return toast.error(`Preço inválido em: ${invalid.nome_produto}`);
    setSaving(true);
    try {
      const r = await api.erp.promotions.saveBulk({
        items: lines.map((l) => ({
          id_produto: l.id_produto,
          vr_promocao: l.vr_promocao,
          quantidade_minima: l.quantidade_minima,
        })),
        descricao: descricao || undefined,
        data_inicio: dataInicio,
        data_fim: dataFim || null,
      });
      toast.success(`${r.count} promoções criadas`);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg" className="max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nova promoção</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 pr-1">
          {/* Campaign metadata */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-3">
            <FormField label="Descrição" hint="Ex.: Semana do consumidor">
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Nome da campanha (opcional)" />
            </FormField>
            <FormField label="Início" required>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </FormField>
            <FormField label="Fim (opcional)">
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </FormField>
          </div>

          {/* Product picker */}
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Buscar e selecionar produtos</label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Nome ou código..." className="pl-9" />
            </div>
            <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-white/5">
              {products.map((p) => {
                const selected = isSelected(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggle(p)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2 border-b border-white/5 last:border-b-0 transition text-left',
                      selected ? 'bg-primary/10' : 'hover:bg-white/5'
                    )}
                  >
                    <div className={cn('w-5 h-5 rounded flex items-center justify-center flex-shrink-0', selected ? 'bg-primary text-primary-foreground' : 'bg-white/5')}>
                      {selected ? <Check className="w-3 h-3" /> : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{p.nome_produto}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {p.cod_barra ?? 'sem código'} · {formatCurrency(Number(p.vr_venda ?? 0))}
                      </div>
                    </div>
                  </button>
                );
              })}
              {products.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">Nenhum produto encontrado</div>
              )}
            </div>
          </div>

          {/* Selected products — per-product editor */}
          {lines.length > 0 && (
            <>
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Aplicar em todos ({lines.length} produtos)</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      value={fillDiscount}
                      onChange={(e) => setFillDiscount(Number(e.target.value) || 0)}
                      className="h-8"
                      placeholder="%"
                    />
                    <Button variant="outline" size="sm" onClick={applyDiscountToAll} title="Aplicar desconto % em todos">
                      <Percent className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={fillFixed}
                      onChange={(e) => setFillFixed(Number(e.target.value) || 0)}
                      className="h-8"
                      placeholder="R$"
                    />
                    <Button variant="outline" size="sm" onClick={applyFixedToAll} title="Aplicar preço fixo em todos">
                      <DollarSign className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      min={1}
                      value={fillMinQty}
                      onChange={(e) => setFillMinQty(Number(e.target.value) || 1)}
                      className="h-8"
                      placeholder="qtd mín"
                    />
                    <Button variant="outline" size="sm" onClick={applyMinQtyToAll} title="Aplicar quantidade mínima em todos">
                      <Tag className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-white/5 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-black/20 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2">Produto</th>
                      <th className="text-right px-3 py-2 w-28">Preço atual</th>
                      <th className="text-right px-3 py-2 w-28">Promo (R$)</th>
                      <th className="text-center px-3 py-2 w-20">A partir de</th>
                      <th className="text-right px-3 py-2 w-16">−%</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => {
                      const desc =
                        l.vr_venda_original > 0
                          ? ((l.vr_venda_original - l.vr_promocao) / l.vr_venda_original) * 100
                          : 0;
                      return (
                        <tr key={l.id_produto} className="border-t border-white/5">
                          <td className="px-3 py-1.5 truncate max-w-[280px]">{l.nome_produto}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground line-through">
                            {formatCurrency(l.vr_venda_original)}
                          </td>
                          <td className="px-3 py-1.5">
                            <Input
                              type="number"
                              step="0.01"
                              value={l.vr_promocao}
                              onChange={(e) => updateLine(l.id_produto, { vr_promocao: Number(e.target.value) || 0 })}
                              className="h-7 text-right tabular-nums font-semibold"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input
                              type="number"
                              min={1}
                              value={l.quantidade_minima}
                              onChange={(e) =>
                                updateLine(l.id_produto, { quantidade_minima: Math.max(1, Math.floor(Number(e.target.value) || 1)) })
                              }
                              className="h-7 text-center tabular-nums"
                            />
                          </td>
                          <td className={cn('px-3 py-1.5 text-right tabular-nums text-xs font-bold', desc > 0 ? 'text-warning' : 'text-muted-foreground')}>
                            {desc > 0 ? `-${desc.toFixed(0)}%` : '—'}
                          </td>
                          <td className="px-2 py-1.5">
                            <Button variant="ghost" size="icon" onClick={() => removeLine(l.id_produto)} title="Remover">
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Dica: promoções com <strong>quantidade mínima maior que 1</strong> só se aplicam no PDV quando o cliente
                leva essa quantidade (ex.: 3 pelo preço de 2, atacado, leve+pague-menos).
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-white/5 pt-3">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving || lines.length === 0}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Criar {lines.length > 0 && `(${lines.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
