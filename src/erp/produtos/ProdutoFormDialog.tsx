import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/FormField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Barcode, DollarSign, FileCheck2, Info, Loader2, Package, Pencil, Plus, Star, Search, Trash2, Truck, X } from 'lucide-react';

type Product = {
  id?: number;
  nome_produto?: string;
  cod_barra?: string | null;
  unidade?: string | null;
  inf_adicional?: string | null;
  id_tipo?: number | null;
  vr_compra?: number | null;
  vr_venda?: number | null;
  vr_venda_2?: number | null;
  min_estoque?: number | null;
  estoque?: number | null;
  fracionado?: number | null;
  ncm?: string | null;
  cfop?: string | null;
  cst_csosn?: string | null;
  cest?: string | null;
  origem_produto?: number | null;
};

const UNIDADES = ['UN', 'KG', 'L', 'M', 'M2', 'M3', 'PC', 'CX', 'DZ'];

type ProductCode = {
  id: number;
  id_produto: number;
  tipo: string;
  codigo: string;
  embalagem: string | null;
  fator: number;
  id_fornecedor: number | null;
  nome_fornecedor: string | null;
  util_venda: number;
  preferencial: number;
  data_inicio: string | null;
  inativo: number;
};

export function ProdutoFormDialog({
  initial,
  open,
  onOpenChange,
  onSaved,
}: {
  initial?: Product;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<Product>({});
  const [categories, setCategories] = useState<Array<{ id: number; nome_tipo: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [tab, setTab] = useState<'geral' | 'precos' | 'fornecedores' | 'codigos' | 'fiscal'>('geral');
  const [allSuppliers, setAllSuppliers] = useState<Array<{ id: number; nome_fornecedor: string; cpf_cnpj: string | null }>>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<number[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [codes, setCodes] = useState<ProductCode[]>([]);

  useEffect(() => {
    if (!open) return;
    setData(initial ?? { unidade: 'UN', estoque: 0, min_estoque: 0, fracionado: 0 });
    setTab('geral');
    setSupplierSearch('');
    setSelectedSupplierIds([]);
    setCodes([]);
    api.erp.products.categories().then(setCategories);
    api.erp.suppliers.list({ limit: 500 }).then((r) =>
      setAllSuppliers(r.rows as unknown as Array<{ id: number; nome_fornecedor: string; cpf_cnpj: string | null }>)
    );
    // If editing existing product, load its current suppliers and codes
    if (initial?.id) {
      api.erp.products.getSuppliers(initial.id).then((rows) => setSelectedSupplierIds(rows.map((r) => r.id)));
      api.erp.products.listCodes(initial.id).then(setCodes);
    }
  }, [open, initial]);

  const reloadCodes = async (optimistic?: ProductCode[]) => {
    if (optimistic) {
      setCodes(optimistic);
      return;
    }
    if (data.id) setCodes(await api.erp.products.listCodes(data.id));
  };

  const update = <K extends keyof Product>(k: K, v: Product[K]) => setData((d) => ({ ...d, [k]: v }));

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const r = await api.erp.products.saveCategory({ nome_tipo: newCategoryName.trim() });
    const list = await api.erp.products.categories();
    setCategories(list);
    setData((d) => ({ ...d, id_tipo: r.id }));
    setNewCategoryName('');
    setAddingCategory(false);
  };

  const handleSave = async () => {
    if (!data.nome_produto?.trim()) {
      toast.error('Informe o nome do produto');
      setTab('geral');
      return;
    }
    setSaving(true);
    try {
      const saveRes = await api.erp.products.save({
        ...data,
        nome_produto: data.nome_produto.trim(),
        cod_barra: data.cod_barra || null,
        unidade: data.unidade || 'UN',
        vr_compra: Number(data.vr_compra ?? 0),
        vr_venda: Number(data.vr_venda ?? 0),
        vr_venda_2: Number(data.vr_venda_2 ?? 0),
        estoque: Number(data.estoque ?? 0),
        min_estoque: Number(data.min_estoque ?? 0),
        fracionado: data.fracionado ? 1 : 0,
        ncm: data.ncm?.trim() || null,
        cfop: data.cfop?.trim() || null,
        cst_csosn: data.cst_csosn?.trim() || null,
        cest: data.cest?.trim() || null,
        origem_produto: data.origem_produto ?? null,
      });
      // Save supplier links (works for both new and existing products)
      await api.erp.products.setSuppliers({ id_produto: saveRes.id, supplier_ids: selectedSupplierIds });
      const wasNew = !initial?.id && !data.id;
      // Keep the id in state so the Códigos tab becomes usable right away
      // and subsequent saves target the same row.
      setData((d) => ({ ...d, id: saveRes.id }));
      // Reload codes so the list reflects the current persisted state
      // (also seeds the list right after a first-time save).
      setCodes(await api.erp.products.listCodes(saveRes.id));
      toast.success(wasNew ? 'Produto cadastrado' : 'Produto atualizado');
      // Refresh the parent list — do NOT close the dialog.
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };

  const toggleSupplier = (id: number) => {
    setSelectedSupplierIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const filteredSuppliers = supplierSearch.trim()
    ? allSuppliers.filter((s) =>
        s.nome_fornecedor.toLowerCase().includes(supplierSearch.toLowerCase()) ||
        (s.cpf_cnpj ?? '').includes(supplierSearch)
      )
    : allSuppliers;

  const selectedSuppliers = allSuppliers.filter((s) => selectedSupplierIds.includes(s.id));

  const hasCustomFiscal = !!(data.ncm || data.cfop || data.cst_csosn || data.cest || data.origem_produto !== null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {data.id ? `Editar ${data.nome_produto?.trim() || 'produto'}` : 'Novo produto'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="geral"><Info className="w-4 h-4 mr-1" /> Geral</TabsTrigger>
            <TabsTrigger value="precos"><DollarSign className="w-4 h-4 mr-1" /> Preços e estoque</TabsTrigger>
            <TabsTrigger value="codigos">
              <Barcode className="w-4 h-4 mr-1" /> Códigos
              {codes.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-primary/20 text-primary rounded-full px-1.5">{codes.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="fornecedores">
              <Truck className="w-4 h-4 mr-1" /> Fornecedores
              {selectedSupplierIds.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-primary/20 text-primary rounded-full px-1.5">{selectedSupplierIds.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="fiscal">
              <FileCheck2 className="w-4 h-4 mr-1" /> Fiscal
              {hasCustomFiscal && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-primary" />}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto pr-1 pt-4">
            <TabsContent value="geral" className="space-y-4 mt-0">
              <FormField label="Nome do produto" required>
                <Input
                  autoFocus
                  value={data.nome_produto ?? ''}
                  onChange={(e) => update('nome_produto', e.target.value)}
                  placeholder="Ex.: COCA COLA 350ML LATA"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Código de barras (EAN)">
                  <Input value={data.cod_barra ?? ''} onChange={(e) => update('cod_barra', e.target.value)} placeholder="789..." />
                </FormField>
                <FormField label="Unidade">
                  <Select value={data.unidade ?? 'UN'} onValueChange={(v) => update('unidade', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              <FormField label="Categoria">
                {addingCategory ? (
                  <div className="flex gap-2">
                    <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nova categoria" autoFocus />
                    <Button variant="outline" onClick={handleAddCategory}>Adicionar</Button>
                    <Button variant="ghost" onClick={() => setAddingCategory(false)}>Cancelar</Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select value={String(data.id_tipo ?? '')} onValueChange={(v) => update('id_tipo', Number(v))}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nome_tipo}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={() => setAddingCategory(true)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </FormField>

              <FormField label="Embalagem / Info adicional" hint="Aparece na etiqueta e no cupom. Ex.: 500ML, 1KG, PACOTE 12 UN">
                <Input value={data.inf_adicional ?? ''} onChange={(e) => update('inf_adicional', e.target.value)} placeholder="500ML" />
              </FormField>

              <div className="flex items-center justify-between rounded-lg bg-black/20 p-3">
                <div>
                  <div className="font-medium text-sm">Vendido por peso (fracionado)</div>
                  <div className="text-xs text-muted-foreground">Integra com balança no PDV</div>
                </div>
                <Switch checked={!!data.fracionado} onCheckedChange={(v) => update('fracionado', v ? 1 : 0)} />
              </div>
            </TabsContent>

            <TabsContent value="precos" className="space-y-4 mt-0">
              <div className="grid grid-cols-3 gap-4">
                <FormField label="Preço de compra" hint="Custo do produto">
                  <Input type="number" step="0.01" value={data.vr_compra ?? ''} onChange={(e) => update('vr_compra', Number(e.target.value))} />
                </FormField>
                <FormField label="Preço de venda" required hint="Preço no PDV">
                  <Input type="number" step="0.01" value={data.vr_venda ?? ''} onChange={(e) => update('vr_venda', Number(e.target.value))} />
                </FormField>
                <FormField label="Preço venda 2" hint="Preço de atacado">
                  <Input type="number" step="0.01" value={data.vr_venda_2 ?? ''} onChange={(e) => update('vr_venda_2', Number(e.target.value))} />
                </FormField>
              </div>

              {(data.vr_venda ?? 0) > 0 && (data.vr_compra ?? 0) > 0 && (
                <div className="rounded-lg bg-success/10 border border-success/30 p-3 text-sm">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Margem de lucro</div>
                  <div className="text-2xl font-bold text-success tabular-nums">
                    {(((Number(data.vr_venda) - Number(data.vr_compra)) / Number(data.vr_compra)) * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Lucro por unidade: R$ {(Number(data.vr_venda) - Number(data.vr_compra)).toFixed(2)}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-white/5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Controle de estoque</div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Estoque atual">
                    <Input type="number" step="0.001" value={data.estoque ?? ''} onChange={(e) => update('estoque', Number(e.target.value))} />
                  </FormField>
                  <FormField label="Estoque mínimo" hint="Alerta quando abaixo">
                    <Input type="number" step="0.001" value={data.min_estoque ?? ''} onChange={(e) => update('min_estoque', Number(e.target.value))} />
                  </FormField>
                </div>
                {(data.min_estoque ?? 0) > 0 && (data.estoque ?? 0) <= (data.min_estoque ?? 0) && (
                  <div className="mt-3 rounded-lg bg-warning/10 border border-warning/30 p-3 text-xs">
                    ⚠️ Estoque atual ({Number(data.estoque ?? 0).toFixed(0)}) está abaixo ou igual ao mínimo. Aparecerá nos alertas do módulo Estoque.
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="codigos" className="space-y-4 mt-0">
              <CodigosPanel
                idProduto={data.id ?? null}
                codBarraPrincipal={data.cod_barra ?? null}
                codes={codes}
                suppliers={allSuppliers}
                onChange={reloadCodes}
              />
            </TabsContent>

            <TabsContent value="fornecedores" className="space-y-4 mt-0">
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
                Vincule os fornecedores deste produto. Útil pra rastrear de onde comprar reposição de estoque e gerar
                pedidos de compra.
              </div>

              {selectedSuppliers.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Fornecedores vinculados ({selectedSuppliers.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedSuppliers.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSupplier(s.id)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/20 transition"
                      >
                        <Truck className="w-3 h-3 text-primary" />
                        <span className="text-xs font-medium">{s.nome_fornecedor}</span>
                        <X className="w-3 h-3 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <FormField label="Adicionar fornecedor">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={supplierSearch}
                      onChange={(e) => setSupplierSearch(e.target.value)}
                      placeholder="Buscar por nome ou CNPJ..."
                      className="pl-9"
                    />
                  </div>
                </FormField>

                <div className="mt-3 space-y-1 max-h-64 overflow-auto">
                  {allSuppliers.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-6">
                      Nenhum fornecedor cadastrado. Cadastre no módulo <strong>Fornecedores</strong> primeiro.
                    </div>
                  )}
                  {filteredSuppliers.map((s) => {
                    const selected = selectedSupplierIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSupplier(s.id)}
                        className={
                          'w-full flex items-center gap-3 p-2 rounded-lg border transition ' +
                          (selected
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-card border-white/5 hover:border-white/20')
                        }
                      >
                        <div className={'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ' + (selected ? 'bg-primary/20' : 'bg-white/5')}>
                          <Truck className={'w-4 h-4 ' + (selected ? 'text-primary' : 'text-muted-foreground')} />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <div className="text-sm font-medium truncate">{s.nome_fornecedor}</div>
                          {s.cpf_cnpj && <div className="text-[10px] text-muted-foreground">{s.cpf_cnpj}</div>}
                        </div>
                        {selected && <Star className="w-4 h-4 text-primary fill-primary" />}
                      </button>
                    );
                  })}
                  {supplierSearch && filteredSuppliers.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">Nenhum resultado</div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="fiscal" className="space-y-4 mt-0">
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
                Estes campos são usados na emissão da NFCe. Deixe em branco para usar os valores padrão configurados em{' '}
                <strong className="text-foreground">Configurações → Emissão fiscal</strong>.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="NCM" hint="Nomenclatura Comum do Mercosul — 8 dígitos">
                  <Input value={data.ncm ?? ''} onChange={(e) => update('ncm', e.target.value)} placeholder="Ex.: 22021000" maxLength={8} />
                </FormField>
                <FormField label="CFOP" hint="Código Fiscal de Operações — 4 dígitos">
                  <Input value={data.cfop ?? ''} onChange={(e) => update('cfop', e.target.value)} placeholder="Ex.: 5102" maxLength={4} />
                </FormField>
                <FormField label="CST / CSOSN" hint="Situação Tributária ICMS">
                  <Input value={data.cst_csosn ?? ''} onChange={(e) => update('cst_csosn', e.target.value)} placeholder="102 (Simples Nacional)" maxLength={4} />
                </FormField>
                <FormField label="CEST" hint="Código Especificador da Substituição Tributária (opcional)">
                  <Input value={data.cest ?? ''} onChange={(e) => update('cest', e.target.value)} placeholder="Ex.: 0300100" maxLength={7} />
                </FormField>
                <FormField label="Origem da mercadoria" className="col-span-2">
                  <Select
                    value={String(data.origem_produto ?? '')}
                    onValueChange={(v) => update('origem_produto', v ? Number(v) : null)}
                  >
                    <SelectTrigger><SelectValue placeholder="Padrão da config" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 — Nacional</SelectItem>
                      <SelectItem value="1">1 — Importação direta</SelectItem>
                      <SelectItem value="2">2 — Importação mercado interno</SelectItem>
                      <SelectItem value="3">3 — Nacional com importação &gt; 40%</SelectItem>
                      <SelectItem value="4">4 — Nacional prod. conformidade</SelectItem>
                      <SelectItem value="5">5 — Nacional com importação ≤ 40%</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="gap-2 pt-4 border-t border-white/5">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            {data.id ? 'Fechar' : 'Cancelar'}
          </Button>
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// CódigosPanel — alternative barcodes / supplier codes tab
// ============================================================

const TIPOS_CODIGO = [
  { value: 'EAN', label: 'EAN / Código de barras' },
  { value: 'FORNECEDOR', label: 'Código do fornecedor' },
  { value: 'BALANCA', label: 'Código de balança' },
];

type CodeDraft = {
  id?: number;
  tipo: string;
  codigo: string;
  embalagem: string;
  fator: number;
  id_fornecedor: number | null;
  util_venda: boolean;
  preferencial: boolean;
  data_inicio: string;
  inativo: boolean;
};

function emptyDraft(): CodeDraft {
  return {
    tipo: 'EAN',
    codigo: '',
    embalagem: '',
    fator: 1,
    id_fornecedor: null,
    util_venda: true,
    preferencial: false,
    data_inicio: '',
    inativo: false,
  };
}

function CodigosPanel({
  idProduto,
  codBarraPrincipal,
  codes,
  suppliers,
  onChange,
}: {
  idProduto: number | null;
  codBarraPrincipal: string | null;
  codes: ProductCode[];
  suppliers: Array<{ id: number; nome_fornecedor: string; cpf_cnpj: string | null }>;
  onChange: (nextCodes?: ProductCode[]) => void;
}) {
  const [editing, setEditing] = useState<CodeDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const supplierName = (id: number | null | undefined) =>
    id ? suppliers.find((s) => s.id === id)?.nome_fornecedor ?? null : null;

  if (!idProduto) {
    return (
      <div className="rounded-lg bg-warning/10 border border-warning/30 p-4 text-sm">
        Salve o produto primeiro para adicionar códigos alternativos.
      </div>
    );
  }

  const startAdd = () => setEditing(emptyDraft());
  const startEdit = (c: ProductCode) =>
    setEditing({
      id: c.id,
      tipo: c.tipo,
      codigo: c.codigo,
      embalagem: c.embalagem ?? '',
      fator: c.fator ?? 1,
      id_fornecedor: c.id_fornecedor,
      util_venda: !!c.util_venda,
      preferencial: !!c.preferencial,
      data_inicio: c.data_inicio ? String(c.data_inicio).slice(0, 10) : '',
      inativo: !!c.inativo,
    });

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.codigo.trim()) {
      toast.error('Informe o código');
      return;
    }
    if (editing.tipo === 'FORNECEDOR' && !editing.id_fornecedor) {
      toast.error('Selecione o fornecedor para este código');
      return;
    }
    setSaving(true);
    // Optimistic: apply changes to the list immediately, then sync with server.
    const isEdit = !!editing.id;
    const draftSnapshot = { ...editing };
    const tempId = isEdit ? editing.id! : -Date.now();
    const nextOptimistic: ProductCode[] = isEdit
      ? codes.map((c) =>
          c.id === editing.id
            ? {
                ...c,
                tipo: draftSnapshot.tipo,
                codigo: draftSnapshot.codigo.trim(),
                embalagem: draftSnapshot.embalagem.trim() || null,
                fator: Number(draftSnapshot.fator) || 1,
                id_fornecedor: draftSnapshot.id_fornecedor,
                nome_fornecedor: supplierName(draftSnapshot.id_fornecedor),
                util_venda: draftSnapshot.util_venda ? 1 : 0,
                preferencial: draftSnapshot.preferencial ? 1 : 0,
                data_inicio: draftSnapshot.data_inicio || null,
                inativo: draftSnapshot.inativo ? 1 : 0,
              }
            : draftSnapshot.preferencial
              ? { ...c, preferencial: 0 }
              : c
        )
      : [
          ...(draftSnapshot.preferencial ? codes.map((c) => ({ ...c, preferencial: 0 })) : codes),
          {
            id: tempId,
            id_produto: idProduto!,
            tipo: draftSnapshot.tipo,
            codigo: draftSnapshot.codigo.trim(),
            embalagem: draftSnapshot.embalagem.trim() || null,
            fator: Number(draftSnapshot.fator) || 1,
            id_fornecedor: draftSnapshot.id_fornecedor,
            nome_fornecedor: supplierName(draftSnapshot.id_fornecedor),
            util_venda: draftSnapshot.util_venda ? 1 : 0,
            preferencial: draftSnapshot.preferencial ? 1 : 0,
            data_inicio: draftSnapshot.data_inicio || null,
            inativo: draftSnapshot.inativo ? 1 : 0,
          },
        ];
    onChange(nextOptimistic);
    setEditing(null);
    try {
      await api.erp.products.saveCode({
        id: editing.id,
        id_produto: idProduto!,
        tipo: draftSnapshot.tipo,
        codigo: draftSnapshot.codigo.trim(),
        embalagem: draftSnapshot.embalagem.trim() || null,
        fator: Number(draftSnapshot.fator) || 1,
        id_fornecedor: draftSnapshot.id_fornecedor,
        util_venda: draftSnapshot.util_venda ? 1 : 0,
        preferencial: draftSnapshot.preferencial ? 1 : 0,
        data_inicio: draftSnapshot.data_inicio || null,
        inativo: draftSnapshot.inativo ? 1 : 0,
      });
      onChange(); // sync from server to get real ID + any coercions
      toast.success('Código salvo');
    } catch (e) {
      toast.error((e as Error).message);
      onChange(); // revert to server state
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remover este código?')) return;
    // Optimistic remove
    onChange(codes.filter((c) => c.id !== id));
    try {
      await api.erp.products.deleteCode(id);
    } catch (e) {
      toast.error((e as Error).message);
      onChange(); // resync
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
        Cadastre códigos alternativos deste produto — quando um EAN muda, adicione o novo aqui em vez de criar outro produto.
        Assim o PDV continua reconhecendo estoque antigo com o código anterior.
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-card border border-white/5 p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Barcode className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Código interno</div>
            <div className="font-mono text-sm truncate">{String(idProduto).padStart(6, '0')}</div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground">Automático</span>
        </div>

        <div className="rounded-lg bg-card border border-white/5 p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Barcode className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">EAN principal</div>
            <div className="font-mono text-sm truncate">{codBarraPrincipal ?? '—'}</div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary">Aba Geral</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Códigos adicionais ({codes.length})</div>
        {!editing && (
          <Button size="sm" variant="outline" onClick={startAdd}>
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
        )}
      </div>

      {editing && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="text-sm font-semibold">{editing.id ? 'Editar código' : 'Novo código'}</div>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Tipo">
              <Select value={editing.tipo} onValueChange={(v) => setEditing({ ...editing, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_CODIGO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label="Código"
              required
              className="col-span-2"
              hint={
                editing.tipo === 'BALANCA'
                  ? 'Código PLU curto (2–5 dígitos) impresso pela balança. Ex.: 234 → EAN 2234...'
                  : undefined
              }
            >
              <Input
                value={editing.codigo}
                onChange={(e) => setEditing({ ...editing, codigo: e.target.value })}
                placeholder={editing.tipo === 'BALANCA' ? 'Ex.: 234' : '789...'}
                autoFocus
              />
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Embalagem" hint="Ex: UN, CX, DZ">
              <Input value={editing.embalagem} onChange={(e) => setEditing({ ...editing, embalagem: e.target.value })} placeholder="UN" />
            </FormField>
            <FormField label="Fator" hint="Qtd por embalagem">
              <Input
                type="number"
                step="0.001"
                value={editing.fator}
                onChange={(e) => setEditing({ ...editing, fator: Number(e.target.value) })}
              />
            </FormField>
            <FormField label="Data início" hint="Opcional">
              <Input
                type="date"
                value={editing.data_inicio}
                onChange={(e) => setEditing({ ...editing, data_inicio: e.target.value })}
              />
            </FormField>
          </div>
          <FormField
            label="Fornecedor vinculado"
            hint={
              editing.tipo === 'FORNECEDOR'
                ? 'Obrigatório para código do fornecedor'
                : editing.tipo === 'BALANCA'
                  ? 'Não se aplica a códigos de balança'
                  : 'Opcional — vincule se o código pertence a um fornecedor'
            }
          >
            <div className="flex gap-2">
              <Select
                value={editing.id_fornecedor ? String(editing.id_fornecedor) : ''}
                onValueChange={(v) => setEditing({ ...editing, id_fornecedor: v ? Number(v) : null })}
              >
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.nome_fornecedor}</SelectItem>)}
                </SelectContent>
              </Select>
              {editing.id_fornecedor && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditing({ ...editing, id_fornecedor: null })}
                  title="Remover vínculo"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </FormField>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch
                checked={editing.util_venda}
                onCheckedChange={(v) => setEditing({ ...editing, util_venda: v })}
              />
              Aceito no PDV
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch
                checked={editing.preferencial}
                onCheckedChange={(v) => setEditing({ ...editing, preferencial: v })}
              />
              Preferencial p/ etiqueta
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch
                checked={editing.inativo}
                onCheckedChange={(v) => setEditing({ ...editing, inativo: v })}
              />
              Inativo
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Salvar código
            </Button>
          </div>
        </div>
      )}

      {codes.length === 0 && !editing && (
        <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
          Nenhum código adicional cadastrado.
        </div>
      )}

      {codes.length > 0 && (
        <div className="rounded-lg border border-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-black/20 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-left px-3 py-2">Código</th>
                <th className="text-left px-3 py-2">Embalagem</th>
                <th className="text-left px-3 py-2">Fornecedor</th>
                <th className="text-center px-3 py-2">PDV</th>
                <th className="text-center px-3 py-2">Pref.</th>
                <th className="text-center px-3 py-2">Status</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className={'border-t border-white/5 ' + (c.inativo ? 'opacity-50' : '')}>
                  <td className="px-3 py-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5">
                      {TIPOS_CODIGO.find((t) => t.value === c.tipo)?.label ?? c.tipo}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono">{c.codigo}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {c.embalagem ? `${c.embalagem} · ${Number(c.fator).toString()}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-[160px]">{c.nome_fornecedor ?? '—'}</td>
                  <td className="px-3 py-2 text-center">{c.util_venda ? '✓' : '—'}</td>
                  <td className="px-3 py-2 text-center">
                    {c.preferencial ? <Star className="w-3.5 h-3.5 text-primary fill-primary inline" /> : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {c.inativo ? (
                      <span className="text-[10px] text-muted-foreground">Inativo</span>
                    ) : (
                      <span className="text-[10px] text-success">Ativo</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(c)} title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} title="Remover">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
