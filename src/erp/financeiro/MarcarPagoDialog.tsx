import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/FormField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type Launch = {
  id: number;
  vr_parcela: number;
  historico: string | null;
};

export function MarcarPagoDialog({ launch, onClose, onSaved }: { launch: Launch; onClose: () => void; onSaved: () => void }) {
  const [dataConfirmacao, setDataConfirmacao] = useState(new Date().toISOString().slice(0, 10));
  const [vrPago, setVrPago] = useState(String(Number(launch.vr_parcela).toFixed(2)).replace('.', ','));
  const [methods, setMethods] = useState<Array<{ id: number; modo_lancamento: string }>>([]);
  const [idModo, setIdModo] = useState<string>('1');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.erp.finance.paymentMethods().then(setMethods);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.erp.finance.launches.markPaid({
        id: launch.id,
        data_confirmacao: dataConfirmacao,
        vr_pago: parseFloat(vrPago.replace(/\./g, '').replace(',', '.')) || Number(launch.vr_parcela),
        id_modo_lancamento: idModo ? Number(idModo) : undefined,
      });
      toast.success('Lançamento baixado');
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-xl bg-success/10 flex items-center justify-center mb-2">
            <CheckCircle2 className="w-7 h-7 text-success" />
          </div>
          <DialogTitle className="text-center">Baixar lançamento</DialogTitle>
        </DialogHeader>

        <div className="rounded-xl bg-black/30 p-4 text-center">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">{launch.historico}</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{formatCurrency(Number(launch.vr_parcela))}</div>
        </div>

        <div className="space-y-3">
          <FormField label="Data do pagamento">
            <Input type="date" value={dataConfirmacao} onChange={(e) => setDataConfirmacao(e.target.value)} />
          </FormField>
          <FormField label="Valor pago">
            <Input value={vrPago} onChange={(e) => setVrPago(e.target.value)} />
          </FormField>
          <FormField label="Forma">
            <Select value={idModo} onValueChange={setIdModo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {methods.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.modo_lancamento}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="success" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
