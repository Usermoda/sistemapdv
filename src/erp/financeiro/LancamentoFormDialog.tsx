import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/FormField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

type Plan = { id: number; plane_cod: number; plane_descricao: string; plane_tipo: 'E' | 'S' };
type Account = { id: number; conta_descricao: string };

export function LancamentoFormDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tipo, setTipo] = useState<'E' | 'S'>('S');
  const [idPlanejamento, setIdPlanejamento] = useState<string>('');
  const [idConta, setIdConta] = useState<string>('');
  const [documento, setDocumento] = useState('');
  const [historico, setHistorico] = useState('');
  const [dataVencimento, setDataVencimento] = useState(new Date().toISOString().slice(0, 10));
  const [vrParcela, setVrParcela] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([api.erp.finance.plans(), api.erp.finance.accounts()]).then(([p, a]) => {
      setPlans(p);
      setAccounts(a);
      if (a.length > 0) setIdConta(String(a[0].id));
    });
    setTipo('S');
    setIdPlanejamento('');
    setDocumento('');
    setHistorico('');
    setDataVencimento(new Date().toISOString().slice(0, 10));
    setVrParcela('');
  }, [open]);

  const filteredPlans = plans.filter((p) => p.plane_tipo === tipo);

  const handleSave = async () => {
    if (!historico.trim()) return toast.error('Informe uma descrição');
    if (!idPlanejamento) return toast.error('Selecione um plano de contas');
    const val = parseFloat(vrParcela.replace(',', '.'));
    if (!val || val <= 0) return toast.error('Valor inválido');

    setSaving(true);
    try {
      await api.erp.finance.launches.save({
        id_planejamento: Number(idPlanejamento),
        id_conta: idConta ? Number(idConta) : null,
        historico,
        documento: documento || null,
        data_vencimento: dataVencimento,
        vr_parcela: val,
        parcela: 1,
        status_lancamento: 1,
      });
      toast.success('Lançamento criado');
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setTipo('S'); setIdPlanejamento(''); }}
              className={`p-3 rounded-lg border-2 transition ${tipo === 'S' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-white/5 hover:border-white/20'}`}
            >
              <div className="font-semibold">A pagar</div>
              <div className="text-xs text-muted-foreground">Despesa / saída</div>
            </button>
            <button
              onClick={() => { setTipo('E'); setIdPlanejamento(''); }}
              className={`p-3 rounded-lg border-2 transition ${tipo === 'E' ? 'border-success bg-success/10 text-success' : 'border-white/5 hover:border-white/20'}`}
            >
              <div className="font-semibold">A receber</div>
              <div className="text-xs text-muted-foreground">Receita / entrada</div>
            </button>
          </div>

          <FormField label="Descrição" required>
            <Input value={historico} onChange={(e) => setHistorico(e.target.value)} placeholder="Ex.: Aluguel da loja - fev/2026" />
          </FormField>

          <FormField label="Plano de contas" required>
            <Select value={idPlanejamento} onValueChange={setIdPlanejamento}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {filteredPlans.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.plane_descricao}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Data de vencimento" required>
              <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} />
            </FormField>
            <FormField label="Valor" required>
              <Input value={vrParcela} onChange={(e) => setVrParcela(e.target.value)} placeholder="0,00" />
            </FormField>
            <FormField label="Documento">
              <Input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="Nota / boleto" />
            </FormField>
            <FormField label="Conta">
              <Select value={idConta} onValueChange={setIdConta}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.conta_descricao}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
