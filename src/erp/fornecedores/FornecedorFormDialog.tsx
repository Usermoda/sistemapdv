import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/FormField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { api } from '@/lib/api';
import { maskCep, maskCnpj, maskPhone, formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Info, Loader2, Package, Plus, Search, Trash2, Truck, X } from 'lucide-react';

type Supplier = {
  id?: number;
  nome_fornecedor?: string;
  cpf_cnpj?: string | null;
  rg_ie?: string | null;
  contato?: string | null;
  telefone?: string | null;
  fax?: string | null;
  email?: string | null;
  cep?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  inf_adicional?: string | null;
};

type ProductRow = {
  id: number;
  nome_produto: string;
  cod_barra: string | null;
  unidade: string | null;
  vr_venda: number | null;
  estoque: number | null;
};

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

export function FornecedorFormDialog({
  initial,
  open,
  onOpenChange,
  onSaved,
}: {
  initial?: Supplier;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<Supplier>({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'geral' | 'produtos'>('geral');
  const [allProducts, setAllProducts] = useState<ProductRow[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setData(initial ?? { uf: 'SP' });
    setTab('geral');
    setSelectedProductIds([]);
    setPickerOpen(false);

    // Load all products for the picker
    setLoadingProducts(true);
    api.erp.products
      .list({ limit: 500 })
      .then((r) => setAllProducts(r.rows as unknown as ProductRow[]))
      .finally(() => setLoadingProducts(false));

    // If editing, load current linked products
    if (initial?.id) {
      api.erp.suppliers.getProducts(initial.id).then((rows) => setSelectedProductIds(rows.map((r) => r.id)));
    }
  }, [open, initial]);

  const update = <K extends keyof Supplier>(k: K, v: Supplier[K]) => setData((d) => ({ ...d, [k]: v }));

  const lookupCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const j = await res.json();
      if (j.erro) return;
      setData((d) => ({
        ...d,
        endereco: j.logradouro ?? d.endereco,
        bairro: j.bairro ?? d.bairro,
        cidade: j.localidade ?? d.cidade,
        uf: j.uf ?? d.uf,
      }));
    } catch {
      // silent
    }
  };

  const handleSave = async () => {
    if (!data.nome_fornecedor?.trim()) {
      toast.error('Informe o nome do fornecedor');
      setTab('geral');
      return;
    }
    setSaving(true);
    try {
      const saveRes = await api.erp.suppliers.save({ ...data, nome_fornecedor: data.nome_fornecedor.trim() });
      // Save linked products
      await api.erp.suppliers.setProducts({ id_fornecedor: saveRes.id, product_ids: selectedProductIds });
      toast.success(initial?.id ? 'Fornecedor atualizado' : 'Fornecedor cadastrado');
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };

  const removeProduct = (id: number) => {
    setSelectedProductIds((prev) => prev.filter((x) => x !== id));
  };

  const addProducts = (ids: number[]) => {
    setSelectedProductIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const selectedProducts = allProducts.filter((p) => selectedProductIds.includes(p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            {initial?.id ? `Editar ${initial.nome_fornecedor ?? 'fornecedor'}` : 'Novo fornecedor'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="geral"><Info className="w-4 h-4 mr-1" /> Geral</TabsTrigger>
            <TabsTrigger value="produtos">
              <Package className="w-4 h-4 mr-1" /> Produtos
              {selectedProductIds.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-primary/20 text-primary rounded-full px-1.5">{selectedProductIds.length}</span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto pr-1 pt-4">
            <TabsContent value="geral" className="space-y-4 mt-0">
              <FormField label="Razão social" required>
                <Input autoFocus value={data.nome_fornecedor ?? ''} onChange={(e) => update('nome_fornecedor', e.target.value)} placeholder="Nome do fornecedor" />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="CNPJ">
                  <Input value={data.cpf_cnpj ?? ''} onChange={(e) => update('cpf_cnpj', maskCnpj(e.target.value))} placeholder="00.000.000/0000-00" />
                </FormField>
                <FormField label="IE">
                  <Input value={data.rg_ie ?? ''} onChange={(e) => update('rg_ie', e.target.value)} />
                </FormField>
                <FormField label="Contato">
                  <Input value={data.contato ?? ''} onChange={(e) => update('contato', e.target.value)} placeholder="Nome do responsável" />
                </FormField>
                <FormField label="Telefone">
                  <Input value={data.telefone ?? ''} onChange={(e) => update('telefone', maskPhone(e.target.value))} />
                </FormField>
                <FormField label="E-mail" className="col-span-2">
                  <Input type="email" value={data.email ?? ''} onChange={(e) => update('email', e.target.value)} />
                </FormField>
              </div>

              <div className="pt-3 border-t border-white/5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Endereço</div>
                <div className="grid grid-cols-4 gap-4">
                  <FormField label="CEP">
                    <Input
                      value={data.cep ?? ''}
                      onChange={(e) => {
                        const v = maskCep(e.target.value);
                        update('cep', v);
                        if (v.replace(/\D/g, '').length === 8) void lookupCep(v);
                      }}
                    />
                  </FormField>
                  <FormField label="Endereço" className="col-span-3">
                    <Input value={data.endereco ?? ''} onChange={(e) => update('endereco', e.target.value)} />
                  </FormField>
                  <FormField label="Bairro" className="col-span-2">
                    <Input value={data.bairro ?? ''} onChange={(e) => update('bairro', e.target.value)} />
                  </FormField>
                  <FormField label="Cidade">
                    <Input value={data.cidade ?? ''} onChange={(e) => update('cidade', e.target.value)} />
                  </FormField>
                  <FormField label="UF">
                    <Select value={data.uf ?? 'SP'} onValueChange={(v) => update('uf', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UFS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
              </div>

              <FormField label="Observações">
                <Input value={data.inf_adicional ?? ''} onChange={(e) => update('inf_adicional', e.target.value)} />
              </FormField>
            </TabsContent>

            <TabsContent value="produtos" className="space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Produtos deste fornecedor</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedProducts.length === 0 ? 'Nenhum produto vinculado' : `${selectedProducts.length} produto${selectedProducts.length === 1 ? '' : 's'} vinculado${selectedProducts.length === 1 ? '' : 's'}`}
                  </div>
                </div>
                <Button onClick={() => setPickerOpen(true)} disabled={loadingProducts || allProducts.length === 0}>
                  <Plus className="w-4 h-4" /> Adicionar produto
                </Button>
              </div>

              {loadingProducts && selectedProducts.length === 0 ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : selectedProducts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 py-10 text-center">
                  <Package className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                  <div className="text-sm text-muted-foreground">Nenhum produto vinculado ainda</div>
                  <div className="text-xs text-muted-foreground mt-1">Clique em "Adicionar produto" para começar</div>
                </div>
              ) : (
                <div className="rounded-xl border border-white/5 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-black/20 text-xs uppercase text-muted-foreground">
                        <th className="text-left px-3 py-2">Produto</th>
                        <th className="text-right px-3 py-2">Preço</th>
                        <th className="text-right px-3 py-2">Estoque</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProducts.map((p) => (
                        <tr key={p.id} className="border-t border-white/5">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-primary flex-shrink-0" />
                              <div className="min-w-0">
                                <div className="font-medium truncate">{p.nome_produto}</div>
                                {p.cod_barra && (
                                  <div className="text-[10px] text-muted-foreground font-mono">{p.cod_barra}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(p.vr_venda ?? 0))}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{Number(p.estoque ?? 0).toFixed(0)} {p.unidade ?? ''}</td>
                          <td className="px-2 py-2">
                            <Button variant="ghost" size="icon" onClick={() => removeProduct(p.id)} title="Remover">
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="gap-2 pt-4 border-t border-white/5">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>

        {pickerOpen && (
          <ProductPickerDialog
            allProducts={allProducts}
            excludedIds={selectedProductIds}
            onClose={() => setPickerOpen(false)}
            onAdd={(ids) => {
              addProducts(ids);
              setPickerOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProductPickerDialog({
  allProducts,
  excludedIds,
  onClose,
  onAdd,
}: {
  allProducts: ProductRow[];
  excludedIds: number[];
  onClose: () => void;
  onAdd: (ids: number[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<number[]>([]);

  const available = allProducts.filter((p) => !excludedIds.includes(p.id));
  const filtered = search.trim()
    ? available.filter((p) =>
        p.nome_produto.toLowerCase().includes(search.toLowerCase()) ||
        (p.cod_barra ?? '').includes(search)
      )
    : available;

  const toggle = (id: number) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Adicionar produtos</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou código de barras..."
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-auto space-y-1 mt-2">
          {available.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6">
              Todos os produtos já estão vinculados
            </div>
          )}
          {filtered.map((p) => {
            const isPicked = picked.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={
                  'w-full flex items-center gap-3 p-2 rounded-lg border transition ' +
                  (isPicked ? 'bg-primary/10 border-primary/30' : 'bg-card border-white/5 hover:border-white/20')
                }
              >
                <div className={'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ' + (isPicked ? 'bg-primary/20' : 'bg-white/5')}>
                  <Package className={'w-4 h-4 ' + (isPicked ? 'text-primary' : 'text-muted-foreground')} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-sm font-medium truncate">{p.nome_produto}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {p.cod_barra ?? 'Sem código'} · {formatCurrency(Number(p.vr_venda ?? 0))}
                  </div>
                </div>
                {isPicked && <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">✓</div>}
              </button>
            );
          })}
          {search && filtered.length === 0 && available.length > 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">Nenhum resultado</div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onAdd(picked)} disabled={picked.length === 0}>
            <Plus className="w-4 h-4" /> Adicionar {picked.length > 0 && `(${picked.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
