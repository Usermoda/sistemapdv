import { useEffect, useState } from 'react';
import { Barcode, Loader2, Package, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/FormField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type Category = { id: number; nome_tipo: string };
type Created = {
  id: number;
  nome_produto: string;
  cod_barra: string | null;
  unidade: string | null;
  vr_venda: number | null;
  estoque: number | null;
  fracionado: number | null;
};

const UNIDADES = ['UN', 'KG', 'L', 'M', 'M2', 'M3', 'PC', 'CX', 'DZ'];

export function QuickProductDialog({
  scannedCode,
  onClose,
  onCreated,
}: {
  scannedCode: string;
  onClose: () => void;
  onCreated: (product: Created) => void;
}) {
  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState('');
  const [unidade, setUnidade] = useState('UN');
  const [estoque, setEstoque] = useState('');
  const [fracionado, setFracionado] = useState(false);
  const [categorias, setCategorias] = useState<Category[]>([]);
  const [idTipo, setIdTipo] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.erp.products.categories().then((c) => {
      setCategorias(c);
      if (c.length > 0) setIdTipo(String(c[0].id));
    });
  }, []);

  const handleSave = async () => {
    if (!nome.trim()) return toast.error('Informe o nome');
    const p = parseFloat(preco.replace(/\./g, '').replace(',', '.'));
    if (!p || p <= 0) return toast.error('Preço de venda inválido');
    setSaving(true);
    try {
      const r = await api.erp.products.save({
        nome_produto: nome.trim().toUpperCase(),
        cod_barra: scannedCode,
        unidade,
        vr_venda: p,
        vr_compra: 0,
        estoque: parseFloat((estoque || '0').replace(',', '.')) || 0,
        min_estoque: 0,
        fracionado: fracionado ? 1 : 0,
        id_tipo: idTipo ? Number(idTipo) : null,
        inativo: 0,
      });
      toast.success('Produto cadastrado');
      onCreated({
        id: r.id,
        nome_produto: nome.trim().toUpperCase(),
        cod_barra: scannedCode,
        unidade,
        vr_venda: p,
        estoque: parseFloat((estoque || '0').replace(',', '.')) || 0,
        fracionado: fracionado ? 1 : 0,
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-xl bg-warning/10 flex items-center justify-center mb-2">
            <Sparkles className="w-7 h-7 text-warning" />
          </div>
          <DialogTitle className="text-center">Produto não cadastrado</DialogTitle>
          <DialogDescription className="text-center">
            Cadastre rapidamente para adicionar ao carrinho agora
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl bg-primary/10 border border-primary/30 p-3 flex items-center gap-3">
          <Barcode className="w-5 h-5 text-primary" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Código de barras</div>
            <div className="font-mono font-semibold truncate">{scannedCode}</div>
          </div>
          <Package className="w-5 h-5 text-primary" />
        </div>

        <div className="space-y-3">
          <FormField label="Nome do produto" required>
            <Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: COCA COLA 350ML LATA" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Preço de venda" required>
              <Input value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </FormField>
            <FormField label="Unidade">
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Estoque inicial">
              <Input value={estoque} onChange={(e) => setEstoque(e.target.value)} placeholder="0" inputMode="decimal" />
            </FormField>
            <FormField label="Categoria">
              <Select value={idTipo} onValueChange={setIdTipo}>
                <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nome_tipo}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-black/20 p-3">
            <div>
              <div className="text-sm font-medium">Vendido por peso</div>
              <div className="text-xs text-muted-foreground">Integra com balança</div>
            </div>
            <Switch checked={fracionado} onCheckedChange={setFracionado} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Cadastrar e adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
