import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/FormField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, ClipboardCheck, Loader2, Package, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type AdjustType = 'A' | 'S' | 'I';
type Product = { id: number; nome_produto: string; unidade: string | null; estoque: number | null };

const MOTIVOS_POSITIVOS = [
  'Contagem física — encontrado excedente',
  'Devolução de cliente',
  'Retorno de venda cancelada',
  'Bonificação recebida',
  'Correção de lançamento anterior',
];
const MOTIVOS_NEGATIVOS = [
  'Perda / quebra',
  'Produto vencido',
  'Furto / desvio',
  'Amostra grátis / consumo interno',
  'Devolução a fornecedor',
  'Contagem física — falta',
];

export function EstoqueEntradaDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [tipo, setTipo] = useState<AdjustType>('A');
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState('');
  const [motivoCustom, setMotivoCustom] = useState('');
  const [dataEntrada, setDataEntrada] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedProduct(null);
    setProductSearch('');
    setTipo('A');
    setQuantidade('');
    setMotivo('');
    setMotivoCustom('');
    setDataEntrada(new Date().toISOString().slice(0, 10));
  }, [open]);

  useEffect(() => {
    if (!open || selectedProduct) return;
    const t = setTimeout(async () => {
      const r = await api.erp.products.list({ search: productSearch, limit: 20 });
      setProducts(r.rows as unknown as Product[]);
    }, 200);
    return () => clearTimeout(t);
  }, [productSearch, open, selectedProduct]);

  const currentStock = Number(selectedProduct?.estoque ?? 0);
  const parsedQtd = parseFloat(quantidade.replace(',', '.')) || 0;
  const newStock =
    tipo === 'A' ? currentStock + parsedQtd :
    tipo === 'S' ? currentStock - parsedQtd :
    parsedQtd;
  const delta = newStock - currentStock;

  const motivosList = tipo === 'S' ? MOTIVOS_NEGATIVOS : tipo === 'A' ? MOTIVOS_POSITIVOS : ['Contagem física — inventário'];
  const finalMotivo = motivo === '__custom' ? motivoCustom.trim() : motivo;

  const handleSave = async () => {
    if (!selectedProduct) return toast.error('Selecione um produto');
    if (parsedQtd < 0) return toast.error('Quantidade não pode ser negativa');
    if (tipo !== 'I' && parsedQtd === 0) return toast.error('Informe uma quantidade maior que zero');
    if (!finalMotivo) return toast.error('Informe o motivo do ajuste');

    setSaving(true);
    try {
      const r = await api.erp.stock.adjust({
        id_produto: selectedProduct.id,
        tipo,
        quantidade: parsedQtd,
        motivo: finalMotivo,
        data_entrada: dataEntrada,
      });
      const acao = tipo === 'A' ? `+${r.delta}` : tipo === 'S' ? `${r.delta}` : `= ${r.newStock}`;
      toast.success(`Estoque de ${selectedProduct.nome_produto}: ${acao} ${selectedProduct.unidade ?? 'UN'}`);
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };

  const tipoOpts = [
    { value: 'A' as const, label: 'Ajuste positivo', icon: ArrowUp, desc: 'Adiciona ao estoque', color: 'text-success' },
    { value: 'S' as const, label: 'Ajuste negativo', icon: ArrowDown, desc: 'Remove do estoque', color: 'text-destructive' },
    { value: 'I' as const, label: 'Inventário', icon: ClipboardCheck, desc: 'Define o valor exato', color: 'text-primary' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajuste de estoque</DialogTitle>
        </DialogHeader>

        {!selectedProduct ? (
          <div className="space-y-3">
            <FormField label="Buscar produto" required>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input autoFocus value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="pl-9" placeholder="Nome, código..." />
              </div>
            </FormField>
            <div className="max-h-64 overflow-auto space-y-1">
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProduct(p)}
                  className="w-full text-left p-3 rounded-lg hover:bg-secondary transition flex items-center gap-3 touch-target"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.nome_produto}</div>
                    <div className="text-xs text-muted-foreground">
                      Estoque: {Number(p.estoque ?? 0).toFixed(0)} {p.unidade}
                    </div>
                  </div>
                </button>
              ))}
              {products.length === 0 && (
                <div className="text-sm text-muted-foreground p-3 text-center">Nenhum produto encontrado</div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-primary/10 border border-primary/30 p-3 flex items-center gap-3">
              <Package className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{selectedProduct.nome_produto}</div>
                <div className="text-xs text-muted-foreground">
                  Estoque atual: <strong className="text-foreground">{currentStock.toFixed(0)} {selectedProduct.unidade}</strong>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedProduct(null)}>
                Trocar
              </Button>
            </div>

            <FormField label="Tipo de ajuste" required>
              <div className="grid grid-cols-3 gap-2">
                {tipoOpts.map((opt) => {
                  const Icon = opt.icon;
                  const active = tipo === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setTipo(opt.value); setMotivo(''); }}
                      className={cn(
                        'p-3 rounded-lg border-2 transition flex flex-col items-center gap-1 text-center',
                        active ? 'border-primary bg-primary/10' : 'border-white/5 hover:border-white/20'
                      )}
                    >
                      <Icon className={cn('w-5 h-5', active ? opt.color : 'text-muted-foreground')} />
                      <div className="text-xs font-semibold">{opt.label}</div>
                      <div className="text-[10px] text-muted-foreground leading-tight">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label={tipo === 'I' ? `Contagem física (${selectedProduct.unidade ?? 'UN'})` : `Quantidade (${selectedProduct.unidade ?? 'UN'})`}
                required
              >
                <Input autoFocus type="number" step="0.001" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="0" />
              </FormField>
              <FormField label="Data">
                <Input type="date" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} />
              </FormField>
            </div>

            {parsedQtd > 0 && (
              <div className={cn(
                'rounded-xl p-3 border text-sm flex items-center justify-between',
                delta > 0 ? 'bg-success/10 border-success/30' :
                delta < 0 ? 'bg-destructive/10 border-destructive/30' :
                'bg-muted/30 border-white/10'
              )}>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Novo estoque</div>
                  <div className="font-bold text-lg tabular-nums">
                    {newStock.toFixed(0)} {selectedProduct.unidade}
                  </div>
                </div>
                <div className={cn('text-right', delta > 0 ? 'text-success' : delta < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                  <div className="text-xs uppercase tracking-wider">Variação</div>
                  <div className="font-bold text-lg tabular-nums">
                    {delta >= 0 ? '+' : ''}{delta.toFixed(0)}
                  </div>
                </div>
              </div>
            )}

            <FormField label="Motivo" required>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger><SelectValue placeholder="Selecione um motivo..." /></SelectTrigger>
                <SelectContent>
                  {motivosList.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  <SelectItem value="__custom">Outro (digitar)</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {motivo === '__custom' && (
              <FormField label="Descreva o motivo" required>
                <Input value={motivoCustom} onChange={(e) => setMotivoCustom(e.target.value)} placeholder="Ex.: Reajuste após contagem por auditoria" />
              </FormField>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !selectedProduct}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Confirmar ajuste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
