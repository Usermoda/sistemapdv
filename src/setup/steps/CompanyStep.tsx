import { useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { api, type CompanyData } from '@/lib/api';
import { maskCep, maskCnpj, maskPhone } from '@/lib/utils';
import { toast } from 'sonner';

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

export function CompanyStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<CompanyData>({
    nome_empresa: '',
    cpf_cpnj: '',
    rg_ie: '',
    im: '',
    cep: '',
    endereco: '',
    bairro: '',
    cidade: '',
    uf: 'SP',
    email: '',
    telefone: '',
    simbolo_monetario: 'R$',
    casas_decimais: 2,
    max_desc: 100,
    qtd_turnos: '1',
    qtd_terminal: 1,
  });

  const update = <K extends keyof CompanyData>(k: K, v: CompanyData[K]) => setData((d) => ({ ...d, [k]: v }));

  const cepLookup = async (cep: string) => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) return;
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
    if (!data.nome_empresa.trim()) {
      toast.error('Informe o nome do comércio');
      return;
    }
    setSaving(true);
    try {
      await api.setup.saveCompany(data);
      toast.success('Cadastro do comércio salvo');
      onNext();
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Cadastro do Comércio</h1>
        <p className="text-muted-foreground">Estes dados aparecerão nos cupons, notas e documentos fiscais.</p>
      </div>

      <div className="rounded-xl border border-white/5 bg-card/50 p-6 space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-white/5">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Dados da empresa</h3>
            <p className="text-xs text-muted-foreground">Identificação e endereço</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <Label>Razão social / Nome do comércio *</Label>
            <Input value={data.nome_empresa} onChange={(e) => update('nome_empresa', e.target.value)} placeholder="Ex.: Minha Empresa Comércio LTDA" />
          </div>
          <div className="space-y-1.5">
            <Label>CNPJ / CPF</Label>
            <Input value={data.cpf_cpnj} onChange={(e) => update('cpf_cpnj', maskCnpj(e.target.value))} placeholder="00.000.000/0000-00" />
          </div>
          <div className="space-y-1.5">
            <Label>Inscrição Estadual</Label>
            <Input value={data.rg_ie} onChange={(e) => update('rg_ie', e.target.value)} placeholder="ISENTO ou nº IE" />
          </div>
          <div className="space-y-1.5">
            <Label>Inscrição Municipal</Label>
            <Input value={data.im} onChange={(e) => update('im', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={data.telefone} onChange={(e) => update('telefone', maskPhone(e.target.value))} placeholder="(11) 99999-9999" />
          </div>

          <div className="space-y-1.5">
            <Label>CEP</Label>
            <Input
              value={data.cep}
              onChange={(e) => {
                const v = maskCep(e.target.value);
                update('cep', v);
                if (v.replace(/\D/g, '').length === 8) void cepLookup(v);
              }}
              placeholder="00000-000"
            />
          </div>
          <div className="space-y-1.5">
            <Label>UF</Label>
            <Select value={data.uf} onValueChange={(v) => update('uf', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UFS.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label>Endereço</Label>
            <Input value={data.endereco} onChange={(e) => update('endereco', e.target.value)} placeholder="Rua, nº" />
          </div>
          <div className="space-y-1.5">
            <Label>Bairro</Label>
            <Input value={data.bairro} onChange={(e) => update('bairro', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <Input value={data.cidade} onChange={(e) => update('cidade', e.target.value)} />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label>E-mail</Label>
            <Input value={data.email} onChange={(e) => update('email', e.target.value)} type="email" placeholder="contato@empresa.com" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-card/50 p-6 space-y-4">
        <h3 className="font-semibold">Preferências operacionais</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Símbolo monetário</Label>
            <Input value={data.simbolo_monetario} onChange={(e) => update('simbolo_monetario', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Casas decimais</Label>
            <Input
              type="number"
              min={2}
              max={4}
              value={data.casas_decimais}
              onChange={(e) => update('casas_decimais', Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Desconto máximo (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={data.max_desc}
              onChange={(e) => update('max_desc', Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Turnos de caixa</Label>
            <Select value={data.qtd_turnos} onValueChange={(v) => update('qtd_turnos', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 turno</SelectItem>
                <SelectItem value="2">2 turnos</SelectItem>
                <SelectItem value="3">3 turnos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Quantidade de terminais</Label>
            <Input
              type="number"
              min={1}
              value={data.qtd_terminal}
              onChange={(e) => update('qtd_terminal', Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} size="lg">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <Button size="lg" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Salvar e continuar <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
