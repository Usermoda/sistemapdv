import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/FormField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { api } from '@/lib/api';
import { maskCep, maskCnpj, maskCpf, maskPhone } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

type Client = {
  id?: number;
  nome_cliente?: string;
  cpf_cnpj?: string | null;
  rg_ie?: string | null;
  telefone?: string | null;
  celular?: string | null;
  email?: string | null;
  cep?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  inf_adicional?: string | null;
};

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

export function ClienteFormDialog({
  initial,
  open,
  onOpenChange,
  onSaved,
}: {
  initial?: Client;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<Client>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial?.id) {
      api.erp.clients.get(initial.id).then((full) => setData((full as Client) ?? initial ?? {}));
    } else {
      setData(initial ?? { uf: 'SP' });
    }
  }, [open, initial]);

  const update = <K extends keyof Client>(k: K, v: Client[K]) => setData((d) => ({ ...d, [k]: v }));

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
    if (!data.nome_cliente?.trim()) {
      toast.error('Informe o nome do cliente');
      return;
    }
    setSaving(true);
    try {
      await api.erp.clients.save({
        ...data,
        nome_cliente: data.nome_cliente.trim(),
      });
      toast.success(initial?.id ? 'Cliente atualizado' : 'Cliente cadastrado');
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };

  const isCnpj = (data.cpf_cnpj ?? '').replace(/\D/g, '').length > 11;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial?.id ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-auto pr-1">
          <FormField label="Nome" required>
            <Input value={data.nome_cliente ?? ''} onChange={(e) => update('nome_cliente', e.target.value)} placeholder="Nome completo ou razão social" />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="CPF/CNPJ">
              <Input
                value={data.cpf_cnpj ?? ''}
                onChange={(e) => update('cpf_cnpj', isCnpj || e.target.value.replace(/\D/g, '').length > 11 ? maskCnpj(e.target.value) : maskCpf(e.target.value))}
                placeholder="000.000.000-00"
              />
            </FormField>
            <FormField label="RG / IE">
              <Input value={data.rg_ie ?? ''} onChange={(e) => update('rg_ie', e.target.value)} />
            </FormField>
            <FormField label="Telefone">
              <Input value={data.telefone ?? ''} onChange={(e) => update('telefone', maskPhone(e.target.value))} placeholder="(11) 3333-3333" />
            </FormField>
            <FormField label="Celular">
              <Input value={data.celular ?? ''} onChange={(e) => update('celular', maskPhone(e.target.value))} placeholder="(11) 99999-9999" />
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
                  placeholder="00000-000"
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
