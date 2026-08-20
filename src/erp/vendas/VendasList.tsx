import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Calendar, CheckCircle2, Clock, FileText, Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { VendaDetailsDialog } from './VendaDetailsDialog';
import { toast } from 'sonner';

type SaleRow = {
  id: number;
  controle: string;
  data_venda: string;
  nome_cliente: string | null;
  vr_total: number;
  vr_dinheiro: number;
  vr_cartao: number;
  terminal: string;
  turno: string;
  nfce_status?: string | null;
  nfce_chave?: string | null;
};

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function VendasList() {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.erp.sales.list({ from, to, search, limit: 200 });
      setRows(res as unknown as SaleRow[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setLoading(false);
  }, [from, to, search]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const totalPeriod = rows.reduce((s, r) => s + Number(r.vr_total ?? 0), 0);

  const columns: Column<SaleRow>[] = [
    {
      key: 'data_venda',
      header: 'Data',
      width: '120px',
      cell: (r) => {
        const d = new Date(r.data_venda);
        return d.toLocaleDateString('pt-BR');
      },
    },
    { key: 'controle', header: 'Controle', cell: (r) => <span className="font-mono text-xs">{r.controle}</span> },
    { key: 'nome_cliente', header: 'Cliente', cell: (r) => r.nome_cliente ?? '—' },
    { key: 'terminal', header: 'Terminal', width: '100px', cell: (r) => `${r.terminal ?? '-'} / ${r.turno ?? '-'}` },
    {
      key: 'nfce_status',
      header: 'NFCe',
      width: '110px',
      cell: (r) => {
        const s = r.nfce_status;
        if (!s) return <span className="text-xs text-muted-foreground">—</span>;
        if (s === 'autorizado')
          return <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="w-3 h-3" /> Autorizada</span>;
        if (s === 'processando_autorizacao' || s === 'pendente')
          return <span className="inline-flex items-center gap-1 text-xs text-warning"><Clock className="w-3 h-3" /> Processando</span>;
        return <span className="inline-flex items-center gap-1 text-xs text-destructive"><AlertCircle className="w-3 h-3" /> {s.replace(/_/g, ' ')}</span>;
      },
    },
    {
      key: 'vr_total',
      header: 'Total',
      className: 'text-right tabular-nums',
      cell: (r) => <span className="font-semibold text-success">{formatCurrency(Number(r.vr_total ?? 0))}</span>,
    },
  ];

  return (
    <div className="p-8">
      <PageHeader
        title="Vendas"
        description={`${rows.length} vendas no período — Total: ${formatCurrency(totalPeriod)}`}
      />

      <div className="flex gap-3 mb-4 items-end">
        <div className="flex-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Busca</label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Controle, cliente..." className="pl-9" />
          </div>
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

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        onRowClick={(r) => setSelected(r.id)}
        getKey={(r) => r.id}
        emptyMessage={
          <div className="flex flex-col items-center gap-2">
            <FileText className="w-10 h-10 opacity-30" />
            <span>Nenhuma venda no período</span>
          </div>
        }
      />

      {selected && <VendaDetailsDialog id={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
