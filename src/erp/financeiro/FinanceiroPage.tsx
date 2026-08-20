import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowDown, ArrowUp, Calendar, CheckCircle2, Plus, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { api } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import { LancamentoFormDialog } from './LancamentoFormDialog';
import { MarcarPagoDialog } from './MarcarPagoDialog';

type Launch = {
  id: number;
  data_vencimento: string;
  data_confirmacao: string | null;
  vr_parcela: number;
  vr_abatimentos: number | null;
  vr_acrescimo: number | null;
  historico: string | null;
  documento: string | null;
  parcela: number | null;
  plane_descricao: string | null;
  plane_tipo: 'E' | 'S' | null;
  conta_descricao: string | null;
  modo_lancamento: string | null;
  nome_cliente: string | null;
};

type Summary = {
  receivable: { total: number; qtd: number };
  payable: { total: number; qtd: number };
  overdue: { total: number; qtd: number };
};

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function daysFromNowIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function FinanceiroPage() {
  const [rows, setRows] = useState<Launch[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(daysFromNowIso(60));
  const [tipo, setTipo] = useState<'E' | 'S' | 'all'>('all');
  const [status, setStatus] = useState<'pending' | 'paid' | 'all'>('pending');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [marking, setMarking] = useState<Launch | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        api.erp.finance.launches.list({ from, to, tipo, status }),
        api.erp.finance.summary(),
      ]);
      setRows(list as unknown as Launch[]);
      setSummary(s as Summary);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [from, to, tipo, status]);

  useEffect(() => {
    const t = setTimeout(load, 150);
    return () => clearTimeout(t);
  }, [load]);

  const cards = [
    {
      label: 'A receber (aberto)',
      icon: ArrowDown,
      color: 'text-success',
      bg: 'bg-success/10',
      total: summary?.receivable.total ?? 0,
      qtd: summary?.receivable.qtd ?? 0,
    },
    {
      label: 'A pagar (aberto)',
      icon: ArrowUp,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
      total: summary?.payable.total ?? 0,
      qtd: summary?.payable.qtd ?? 0,
    },
    {
      label: 'Vencidos',
      icon: AlertTriangle,
      color: 'text-warning',
      bg: 'bg-warning/10',
      total: summary?.overdue.total ?? 0,
      qtd: summary?.overdue.qtd ?? 0,
    },
  ];

  const columns: Column<Launch>[] = [
    {
      key: 'plane_tipo',
      header: '',
      width: '40px',
      cell: (r) => (
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', r.plane_tipo === 'E' ? 'bg-success/10' : 'bg-destructive/10')}>
          {r.plane_tipo === 'E' ? <ArrowDown className="w-4 h-4 text-success" /> : <ArrowUp className="w-4 h-4 text-destructive" />}
        </div>
      ),
    },
    {
      key: 'data_vencimento',
      header: 'Vencimento',
      width: '120px',
      cell: (r) => {
        const d = new Date(r.data_vencimento);
        const overdue = !r.data_confirmacao && d < new Date();
        return <span className={overdue ? 'text-warning' : ''}>{d.toLocaleDateString('pt-BR')}</span>;
      },
    },
    {
      key: 'historico',
      header: 'Descrição',
      cell: (r) => (
        <div>
          <div className="font-medium">{r.historico ?? '—'}</div>
          {r.plane_descricao && <div className="text-xs text-muted-foreground">{r.plane_descricao}</div>}
        </div>
      ),
    },
    { key: 'nome_cliente', header: 'Cliente/Contato', cell: (r) => r.nome_cliente ?? '—' },
    { key: 'documento', header: 'Doc', cell: (r) => r.documento ?? '—' },
    {
      key: 'vr_parcela',
      header: 'Valor',
      className: 'text-right tabular-nums',
      cell: (r) => <span className={cn('font-semibold', r.plane_tipo === 'E' ? 'text-success' : 'text-destructive')}>{formatCurrency(Number(r.vr_parcela))}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      cell: (r) => {
        if (r.data_confirmacao && r.data_confirmacao !== '0000-00-00') {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-success">
              <CheckCircle2 className="w-3 h-3" /> Pago
            </span>
          );
        }
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              setMarking(r);
            }}
          >
            Baixar
          </Button>
        );
      },
    },
  ];

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Financeiro"
        description="Contas a pagar e a receber"
        actions={<Button size="lg" onClick={() => setCreating(true)}><Plus className="w-4 h-4" /> Novo lançamento</Button>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="h-full">
              <Card className="h-full flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardDescription>{c.label}</CardDescription>
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', c.bg)}>
                    <Icon className={cn('w-4 h-4', c.color)} />
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-end">
                  <div className="text-3xl font-bold tabular-nums">{formatCurrency(Number(c.total))}</div>
                  <p className="text-xs text-muted-foreground mt-1 min-h-[1rem]">{c.qtd} lançamentos</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-shrink-0">
          <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" /> De
          </label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-40" />
        </div>
        <div className="flex-shrink-0">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Até</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-40" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Tipo</label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
            <SelectTrigger className="mt-1 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="E">A receber</SelectItem>
              <SelectItem value="S">A pagar</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Status</label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="mt-1 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Em aberto</SelectItem>
              <SelectItem value="paid">Pagos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        getKey={(r) => r.id}
        emptyMessage={
          <div className="flex flex-col items-center gap-2 py-6">
            <Wallet className="w-10 h-10 opacity-30" />
            <span>Nenhum lançamento no período</span>
          </div>
        }
      />

      {creating && <LancamentoFormDialog open={creating} onOpenChange={setCreating} onSaved={load} />}
      {marking && (
        <MarcarPagoDialog
          launch={marking}
          onClose={() => setMarking(null)}
          onSaved={() => {
            setMarking(null);
            load();
          }}
        />
      )}
    </div>
  );
}
