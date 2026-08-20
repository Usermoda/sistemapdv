import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Calendar, ClipboardCheck, FileText, History, Package, Plus, Search, Warehouse } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { EstoqueEntradaDialog } from './EstoqueEntradaDialog';

type StockRow = {
  id: number;
  data_entrada: string;
  quantidade: number;
  valor: number;
  nota_entrada: string | null;
  nome_produto: string | null;
  nome_fornecedor: string | null;
  modo_lancamento: string | null;
  tipo: 'N' | 'A' | 'S' | 'I' | null;
  motivo: string | null;
};

type LowStockRow = { id: number; nome_produto: string; unidade: string; estoque: number; min_estoque: number };
type TipoFiltro = 'A' | 'S' | 'I' | 'all';

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function EstoquePage() {
  const [history, setHistory] = useState<StockRow[]>([]);
  const [low, setLow] = useState<LowStockRow[]>([]);
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [tipo, setTipo] = useState<TipoFiltro>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [hist, lows] = await Promise.all([
        api.erp.stock.history({ from, to, tipo: tipo === 'all' ? undefined : tipo }),
        api.erp.stock.low(),
      ]);
      // Filter to only adjustment types (exclude 'N' notas fiscais — those são no módulo NF-e)
      const filteredHist = (hist as unknown as StockRow[]).filter((h) => h.tipo !== 'N');
      setHistory(filteredHist);
      setLow(lows as unknown as LowStockRow[]);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [from, to, tipo]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const filtered = search
    ? history.filter((h) => (h.nome_produto ?? '').toLowerCase().includes(search.toLowerCase()))
    : history;

  const renderTipoBadge = (t: StockRow['tipo']) => {
    if (t === 'A') return <span className="inline-flex items-center gap-1 text-xs text-success"><ArrowUp className="w-3 h-3" /> Ajuste +</span>;
    if (t === 'S') return <span className="inline-flex items-center gap-1 text-xs text-destructive"><ArrowDown className="w-3 h-3" /> Ajuste −</span>;
    if (t === 'I') return <span className="inline-flex items-center gap-1 text-xs text-primary"><ClipboardCheck className="w-3 h-3" /> Inventário</span>;
    return <span className="text-xs text-muted-foreground">—</span>;
  };

  const columns: Column<StockRow>[] = [
    {
      key: 'data_entrada',
      header: 'Data',
      width: '110px',
      cell: (r) => new Date(r.data_entrada).toLocaleDateString('pt-BR'),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      width: '120px',
      cell: (r) => renderTipoBadge(r.tipo),
    },
    { key: 'nome_produto', header: 'Produto' },
    { key: 'motivo', header: 'Motivo', cell: (r) => r.motivo ?? '—' },
    {
      key: 'quantidade',
      header: 'Variação',
      className: 'text-right tabular-nums',
      cell: (r) => {
        const q = Number(r.quantidade);
        const color = q > 0 ? 'text-success' : q < 0 ? 'text-destructive' : 'text-muted-foreground';
        return <span className={cn('font-semibold', color)}>{q > 0 ? '+' : ''}{q.toLocaleString('pt-BR')}</span>;
      },
    },
  ];

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Ajuste de estoque"
        description="Ajustes manuais, inventário e alertas de estoque baixo. Para entradas por nota fiscal use o módulo Entrada por NF-e."
        actions={
          <Button size="lg" onClick={() => setEntryOpen(true)}>
            <Plus className="w-4 h-4" /> Ajuste manual
          </Button>
        }
      />

      {low.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              {low.length} produtos com estoque baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {low.slice(0, 12).map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-black/20">
                  <Package className="w-4 h-4 text-warning flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.nome_produto}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {Number(p.estoque).toFixed(0)} / mín {Number(p.min_estoque).toFixed(0)} {p.unidade}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Buscar produto</label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Nome do produto..." />
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Tipo</label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as TipoFiltro)}>
            <SelectTrigger className="mt-1 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="A">Ajuste +</SelectItem>
              <SelectItem value="S">Ajuste −</SelectItem>
              <SelectItem value="I">Inventário</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" /> De
          </label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Até</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
          <History className="w-4 h-4" />
          Histórico de ajustes ({filtered.length})
          <span className="text-[10px] text-muted-foreground ml-auto inline-flex items-center gap-1">
            <FileText className="w-3 h-3" />
            Entradas por nota fiscal ficam no módulo Entrada por NF-e
          </span>
        </div>
        <DataTable
          columns={columns}
          rows={filtered}
          loading={loading}
          getKey={(r) => r.id}
          emptyMessage={
            <div className="flex flex-col items-center gap-2 py-6">
              <Warehouse className={cn('w-10 h-10 opacity-30')} />
              <span>Nenhum ajuste no período</span>
              <span className="text-xs text-muted-foreground">Clique em "Ajuste manual" para registrar contagem, perda ou inventário</span>
            </div>
          }
        />
      </div>

      {entryOpen && <EstoqueEntradaDialog open={entryOpen} onOpenChange={setEntryOpen} onSaved={load} />}
    </div>
  );
}
