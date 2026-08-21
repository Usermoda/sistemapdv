import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, CreditCard, Loader2, Plus, Trash2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type Method = { id: number; modo_lancamento: string; protegido: string | null; inativo: number };

// Presets comuns — o admin pode ativar em 1 clique
const PRESETS = [
  'PIX',
  'CARTÃO DE CRÉDITO',
  'CARTÃO DE DÉBITO',
  'VOUCHER / TICKET',
  'FIADO / CREDIÁRIO',
  'CHEQUE',
];

export function PaymentMethodsStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [methods, setMethods] = useState<Method[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try {
      const rows = (await api.erp.paymentMethods.list()) as Method[];
      setMethods(rows);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const addMethod = async (name: string) => {
    const n = name.trim().toUpperCase();
    if (!n) return;
    setAdding(true);
    try {
      await api.erp.paymentMethods.save({ modo_lancamento: n });
      setNewName('');
      await load();
      toast.success(`${n} adicionada`);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setAdding(false);
  };

  const toggle = async (m: Method) => {
    try {
      await api.erp.paymentMethods.toggleActive(m.id, !!m.inativo === false);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (m: Method) => {
    if (m.protegido) {
      toast.error('Formas protegidas (Dinheiro/Cartão) não podem ser removidas — desative com o switch.');
      return;
    }
    if (!confirm(`Remover "${m.modo_lancamento}"?`)) return;
    try {
      await api.erp.paymentMethods.delete(m.id);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const existingNames = new Set(methods.map((m) => m.modo_lancamento.toUpperCase()));
  const presetsToAdd = PRESETS.filter((p) => !existingNames.has(p.toUpperCase()));

  return (
    <div className="space-y-8">
      <div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4"
        >
          <Wallet className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">Formas de pagamento</span>
        </motion.div>
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mb-3">
          Como você recebe?
        </h1>
        <p className="text-muted-foreground max-w-xl">
          Ative as formas que sua loja aceita. As protegidas (Dinheiro/Cartão) já vêm ativas.
          Você pode ajustar depois em Configurações.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-white/5 overflow-hidden bg-black/20">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black/30 text-xs uppercase text-muted-foreground">
                  <th className="text-left px-4 py-2.5">Forma</th>
                  <th className="text-center px-4 py-2.5 w-32">Status</th>
                  <th className="w-14"></th>
                </tr>
              </thead>
              <tbody>
                {methods.map((m) => (
                  <tr key={m.id} className="border-t border-white/5">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-primary" />
                        <span>{m.modo_lancamento}</span>
                        {m.protegido && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-muted-foreground">
                            padrão
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Switch checked={!m.inativo} onCheckedChange={() => toggle(m)} />
                    </td>
                    <td className="px-2 py-2 text-right">
                      {!m.protegido && (
                        <Button variant="ghost" size="icon" onClick={() => remove(m)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {presetsToAdd.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Sugestões rápidas
              </div>
              <div className="flex flex-wrap gap-2">
                {presetsToAdd.map((p) => (
                  <Button
                    key={p}
                    variant="outline"
                    size="sm"
                    onClick={() => addMethod(p)}
                    disabled={adding}
                  >
                    <Plus className="w-3.5 h-3.5" /> {p}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Adicionar personalizada
            </div>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex.: PIX MAQUININHA STONE"
                onKeyDown={(e) => e.key === 'Enter' && addMethod(newName)}
                className="flex-1"
              />
              <Button onClick={() => addMethod(newName)} disabled={adding || !newName.trim()}>
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Adicionar
              </Button>
            </div>
          </div>
        </>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <Button onClick={onNext} size="lg">
          Continuar <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
