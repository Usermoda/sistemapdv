import { useState } from 'react';
import { AlertCircle, ArrowRight, Building2, CheckCircle2, FileText, Loader2, Package, Percent, Upload } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { FormField } from '@/components/FormField';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { api, type NFeParsed, type NFeItem } from '@/lib/api';
import { formatCurrency, cn, maskCnpj } from '@/lib/utils';
import { toast } from 'sonner';

type MatchResult = {
  item: NFeItem;
  matchedProductId: number | null;
  matchedBy: 'barcode' | 'name' | null;
  matchedName?: string;
  matchedPrice?: number;
  matchedStock?: number;
};

type ItemDecision = {
  action: 'create' | 'update' | 'skip';
  productId?: number;
  suggestedPrice?: number;
};

export function NFeImportPage() {
  const [parsed, setParsed] = useState<NFeParsed | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [decisions, setDecisions] = useState<Record<number, ItemDecision>>({});
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [markup, setMarkup] = useState(30);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);

  const pickFile = async () => {
    setLoading(true);
    setResult(null);
    try {
      const r = await api.erp.nfe.pickFile();
      if (!r) {
        setLoading(false);
        return;
      }
      setParsed(r.parsed);
      const m = await api.erp.nfe.matchItems(r.parsed.items);
      setMatches(m);
      // Default decisions: matched → update, not matched → create
      const decs: Record<number, ItemDecision> = {};
      m.forEach((mr) => {
        decs[mr.item.n] = mr.matchedProductId
          ? { action: 'update', productId: mr.matchedProductId, suggestedPrice: mr.matchedPrice }
          : { action: 'create', suggestedPrice: mr.item.vUnCom * (1 + 30 / 100) };
      });
      setDecisions(decs);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setLoading(false);
  };

  const setDecision = (n: number, patch: Partial<ItemDecision>) => {
    setDecisions((prev) => ({ ...prev, [n]: { ...(prev[n] ?? { action: 'skip' }), ...patch } }));
  };

  const applyMarkupToAll = () => {
    if (!parsed) return;
    setDecisions((prev) => {
      const next = { ...prev };
      for (const it of parsed.items) {
        if (next[it.n]?.action === 'create') {
          next[it.n] = { ...next[it.n], suggestedPrice: it.vUnCom * (1 + markup / 100) };
        }
      }
      return next;
    });
    toast.success(`Markup de ${markup}% aplicado a todos os produtos novos`);
  };

  const doImport = async () => {
    if (!parsed) return;
    setImporting(true);
    try {
      const mappings = parsed.items.map((it) => {
        const d = decisions[it.n] ?? { action: 'skip' as const };
        return { item: it, ...d };
      });
      const r = await api.erp.nfe.import({
        parsed,
        mappings,
        supplierId: null, // auto-detect/create from emitente
        markupPercent: markup,
      });
      setResult({ created: r.created, updated: r.updated, skipped: r.skipped });
      toast.success(`Importação concluída: ${r.created} novos, ${r.updated} atualizados, ${r.skipped} ignorados`);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setImporting(false);
  };

  const reset = () => {
    setParsed(null);
    setMatches([]);
    setDecisions({});
    setResult(null);
  };

  // --- Empty state ---
  if (!parsed) {
    return (
      <div className="p-8 space-y-6">
        <PageHeader
          title="Entrada por NF-e"
          description="Importe um XML de nota fiscal do fornecedor para dar entrada em estoque automaticamente"
        />

        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Selecione o XML da NF-e</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                O sistema lê a nota, casa os produtos pelo código de barras e cria ou atualiza automaticamente. Também cadastra o fornecedor se ainda não existir.
              </p>
            </div>
            <Button size="lg" onClick={pickFile} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Escolher arquivo XML
            </Button>
            <div className="text-xs text-muted-foreground max-w-md mx-auto pt-4">
              Formatos aceitos: XML de <strong>NF-e / NFC-e modelo 55/65</strong> emitida pelo fornecedor.
              Não é necessário certificado digital — apenas o arquivo do XML.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Result screen ---
  if (result) {
    return (
      <div className="p-8 space-y-6">
        <PageHeader title="Entrada por NF-e" />
        <Card className="max-w-lg mx-auto">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">NF-e importada</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Nota nº {parsed.numero} de <strong className="text-foreground">{parsed.emitente.xNome}</strong>
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-4">
              <div className="rounded-xl bg-success/10 p-3">
                <div className="text-2xl font-bold text-success tabular-nums">{result.created}</div>
                <div className="text-[10px] uppercase text-muted-foreground">Produtos novos</div>
              </div>
              <div className="rounded-xl bg-primary/10 p-3">
                <div className="text-2xl font-bold text-primary tabular-nums">{result.updated}</div>
                <div className="text-[10px] uppercase text-muted-foreground">Atualizados</div>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <div className="text-2xl font-bold tabular-nums">{result.skipped}</div>
                <div className="text-[10px] uppercase text-muted-foreground">Ignorados</div>
              </div>
            </div>
            <div className="pt-4 flex gap-2 justify-center">
              <Button variant="outline" onClick={reset}>Importar outra NF-e</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Review screen ---
  const totalItems = parsed.items.length;
  const toCreate = Object.values(decisions).filter((d) => d.action === 'create').length;
  const toUpdate = Object.values(decisions).filter((d) => d.action === 'update').length;
  const toSkip = Object.values(decisions).filter((d) => d.action === 'skip').length;

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Revisar importação da NF-e"
        description={`Nota ${parsed.numero} · ${totalItems} itens · Total ${formatCurrency(parsed.totalNota)}`}
        actions={
          <>
            <Button variant="ghost" onClick={reset}>Cancelar</Button>
            <Button size="lg" onClick={doImport} disabled={importing || toCreate + toUpdate === 0}>
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Confirmar importação
            </Button>
          </>
        }
      />

      {/* Supplier info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> Fornecedor
          </CardTitle>
          <CardDescription>Se ainda não estiver cadastrado, será criado automaticamente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Razão social</div>
              <div className="font-medium">{parsed.emitente.xNome}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">CNPJ</div>
              <div className="font-mono text-sm">{maskCnpj(parsed.emitente.CNPJ)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Cidade / UF</div>
              <div>{parsed.emitente.xMun ?? '—'} {parsed.emitente.UF ? `- ${parsed.emitente.UF}` : ''}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground">Data de emissão</div>
              <div>{parsed.dataEmissao ? new Date(parsed.dataEmissao).toLocaleDateString('pt-BR') : '—'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl bg-success/5 border border-success/20 p-3">
          <div className="text-xs uppercase text-muted-foreground">Novos produtos</div>
          <div className="text-2xl font-bold text-success tabular-nums">{toCreate}</div>
        </div>
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
          <div className="text-xs uppercase text-muted-foreground">Atualizações</div>
          <div className="text-2xl font-bold text-primary tabular-nums">{toUpdate}</div>
        </div>
        <div className="rounded-xl bg-muted/30 border border-white/5 p-3">
          <div className="text-xs uppercase text-muted-foreground">Ignorados</div>
          <div className="text-2xl font-bold tabular-nums">{toSkip}</div>
        </div>
        <div className="rounded-xl bg-warning/5 border border-warning/20 p-3 flex items-center gap-2">
          <div className="flex-1">
            <FormField label="Markup padrão">
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Input type="number" value={markup} onChange={(e) => setMarkup(Number(e.target.value) || 0)} className="pr-6" />
                  <Percent className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                </div>
                <Button size="sm" variant="outline" onClick={applyMarkupToAll}>Aplicar</Button>
              </div>
            </FormField>
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="rounded-xl border border-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-black/20 text-xs uppercase text-muted-foreground">
              <th className="text-left px-3 py-2 w-8">#</th>
              <th className="text-left px-3 py-2">Produto na NF-e</th>
              <th className="text-right px-3 py-2">Qtd</th>
              <th className="text-right px-3 py-2">Custo un.</th>
              <th className="text-center px-3 py-2">Match</th>
              <th className="text-left px-3 py-2 w-40">Ação</th>
              <th className="text-right px-3 py-2 w-32">Preço venda</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => {
              const it = m.item;
              const d = decisions[it.n] ?? { action: 'skip' as const };
              return (
                <tr key={it.n} className={cn('border-t border-white/5', d.action === 'skip' && 'opacity-50')}>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{it.n}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{it.xProd}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {it.cEAN ?? 'sem EAN'} · NCM {it.NCM ?? '—'} · {it.uCom}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{it.qCom.toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(it.vUnCom)}</td>
                  <td className="px-3 py-2 text-center">
                    {m.matchedProductId ? (
                      <div className="inline-flex items-center gap-1 text-xs text-success" title={m.matchedName}>
                        <CheckCircle2 className="w-3 h-3" />
                        {m.matchedBy === 'barcode' ? 'EAN' : 'Nome'}
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 text-xs text-warning">
                        <AlertCircle className="w-3 h-3" /> Novo
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Select value={d.action} onValueChange={(v) => setDecision(it.n, { action: v as 'create' | 'update' | 'skip' })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {m.matchedProductId ? (
                          <SelectItem value="update">Atualizar existente</SelectItem>
                        ) : (
                          <SelectItem value="create">Criar novo</SelectItem>
                        )}
                        <SelectItem value="skip">Ignorar</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {d.action !== 'skip' ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={d.suggestedPrice ?? ''}
                        onChange={(e) => setDecision(it.n, { suggestedPrice: Number(e.target.value) || 0 })}
                        className="h-8 text-right tabular-nums"
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-sm flex items-start gap-3">
        <Package className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">O que acontece ao confirmar</div>
          <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 list-disc list-inside">
            <li>Fornecedor cadastrado (ou reutilizado se CNPJ já existe)</li>
            <li>Produtos <strong>novos</strong> criados com dados fiscais da nota</li>
            <li>Produtos <strong>existentes</strong> têm o custo atualizado</li>
            <li>Estoque incrementado com a quantidade da nota</li>
            <li>Histórico registrado em Movimentações de Estoque com o número da nota</li>
            <li>Cada produto é vinculado ao fornecedor</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
