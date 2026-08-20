import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Download, FileBarChart, Package, ShoppingBag, Wallet, AlertTriangle, Printer } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column as TableCol } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import { exportXLSX, printReport, type Column as ReportCol, fmtCurrency, fmtNumber } from '@/lib/reportUtils';

type ReportKey = 'vendas' | 'produtos' | 'caixas' | 'financeiro' | 'estoque_baixo';

const REPORTS: { key: ReportKey; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { key: 'vendas', label: 'Vendas por período', icon: ShoppingBag, description: 'Total diário, formas de pagamento e ticket médio' },
  { key: 'produtos', label: 'Produtos mais vendidos', icon: Package, description: 'Ranking por quantidade e por valor' },
  { key: 'caixas', label: 'Fechamento de caixas', icon: Wallet, description: 'Aberturas, fechamentos e diferença' },
  { key: 'financeiro', label: 'Financeiro', icon: FileBarChart, description: 'Contas a pagar e a receber' },
  { key: 'estoque_baixo', label: 'Estoque baixo', icon: AlertTriangle, description: 'Produtos abaixo do estoque mínimo' },
];

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function RelatoriosPage() {
  const [selected, setSelected] = useState<ReportKey>('vendas');
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [tipo, setTipo] = useState<'E' | 'S' | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ rows: Record<string, unknown>[]; summary?: Array<{ label: string; value: string }>; extras?: Record<string, unknown> }>({
    rows: [],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (selected === 'vendas') {
        const r = await api.reports.salesByPeriod({ from, to });
        setData({
          rows: r.rows as unknown as Record<string, unknown>[],
          summary: [
            { label: 'Pedidos', value: String(r.total.pedidos) },
            { label: 'Total', value: fmtCurrency(r.total.total) },
            { label: 'Ticket médio', value: fmtCurrency(r.total.ticket_medio) },
          ],
        });
      } else if (selected === 'produtos') {
        const rows = await api.reports.topProducts({ from, to, limit: 200 });
        const totalValor = rows.reduce((s, r) => s + Number(r.total_valor), 0);
        const totalQtd = rows.reduce((s, r) => s + Number(r.total_qtd), 0);
        setData({
          rows: rows as unknown as Record<string, unknown>[],
          summary: [
            { label: 'Produtos vendidos', value: String(rows.length) },
            { label: 'Qtd total', value: fmtNumber(totalQtd) },
            { label: 'Faturamento', value: fmtCurrency(totalValor) },
          ],
        });
      } else if (selected === 'caixas') {
        const rows = await api.reports.cashierClosures({ from, to });
        const totalVendas = rows.reduce((s, r) => s + Number(r.total_vendas ?? 0), 0);
        setData({
          rows: rows as unknown as Record<string, unknown>[],
          summary: [
            { label: 'Turnos', value: String(rows.length) },
            { label: 'Total vendido', value: fmtCurrency(totalVendas) },
          ],
        });
      } else if (selected === 'financeiro') {
        const rows = await api.reports.finance({ from, to, tipo });
        const receber = rows.filter((r) => r.plane_tipo === 'E').reduce((s, r) => s + Number(r.vr_parcela), 0);
        const pagar = rows.filter((r) => r.plane_tipo === 'S').reduce((s, r) => s + Number(r.vr_parcela), 0);
        const pagos = rows.filter((r) => r.data_confirmacao && r.data_confirmacao !== '0000-00-00').length;
        setData({
          rows: rows as unknown as Record<string, unknown>[],
          summary: [
            { label: 'Lançamentos', value: String(rows.length) },
            { label: 'A receber', value: fmtCurrency(receber) },
            { label: 'A pagar', value: fmtCurrency(pagar) },
            { label: 'Baixados', value: String(pagos) },
          ],
        });
      } else if (selected === 'estoque_baixo') {
        const rows = await api.reports.lowStock();
        setData({
          rows: rows as unknown as Record<string, unknown>[],
          summary: [{ label: 'Produtos críticos', value: String(rows.length) }],
        });
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [selected, from, to, tipo]);

  useEffect(() => {
    const t = setTimeout(load, 100);
    return () => clearTimeout(t);
  }, [load]);

  const cols = getColumns(selected);
  const tableCols: TableCol<Record<string, unknown>>[] = cols.map((c) => ({
    key: c.key,
    header: c.header,
    className:
      c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : undefined,
    cell: (r) => {
      const v = r[c.key];
      if (c.format === 'currency') return <span className="tabular-nums">{fmtCurrency(v)}</span>;
      if (c.format === 'number') return <span className="tabular-nums">{fmtNumber(v)}</span>;
      if (c.format === 'date') return v ? new Date(String(v)).toLocaleDateString('pt-BR') : '—';
      return v == null || v === '' ? '—' : String(v);
    },
  }));

  const currentReport = REPORTS.find((r) => r.key === selected)!;
  const subtitle = selected === 'estoque_baixo'
    ? 'Situação atual'
    : `Período: ${new Date(from).toLocaleDateString('pt-BR')} até ${new Date(to).toLocaleDateString('pt-BR')}`;

  const download = () => {
    exportXLSX(`${selected}_${from}_${to}`, currentReport.label, cols, data.rows);
  };
  const print = () => {
    printReport(currentReport.label, subtitle, cols, data.rows, data.summary);
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Relatórios"
        description="Análises de vendas, estoque e financeiro com exportação"
        actions={
          <>
            <Button variant="outline" onClick={print} disabled={loading}>
              <Printer className="w-4 h-4" /> Imprimir / PDF
            </Button>
            <Button onClick={download} disabled={loading}>
              <Download className="w-4 h-4" /> Excel
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          const active = selected === r.key;
          return (
            <motion.button
              key={r.key}
              onClick={() => setSelected(r.key)}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'text-left p-4 rounded-xl border-2 transition-all',
                active ? 'border-primary bg-primary/10' : 'border-white/5 hover:border-white/20 bg-card/50'
              )}
            >
              <Icon className={cn('w-5 h-5 mb-2', active ? 'text-primary' : 'text-muted-foreground')} />
              <div className="font-semibold text-sm">{r.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{r.description}</div>
            </motion.button>
          );
        })}
      </div>

      {selected !== 'estoque_baixo' && (
        <div className="flex gap-3 items-end">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" /> De
            </label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-40" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Até</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-40" />
          </div>
          {selected === 'financeiro' && (
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
          )}
        </div>
      )}

      {data.summary && data.summary.length > 0 && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {data.summary.map((s) => (
            <Card key={s.label} className="h-full flex flex-col">
              <CardHeader className="pb-2 space-y-0">
                <CardDescription>{s.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DataTable
        columns={tableCols}
        rows={data.rows}
        loading={loading}
        getKey={(_r, i) => i}
        emptyMessage={loading ? 'Carregando...' : 'Nenhum dado no período'}
      />

      <div className="text-xs text-muted-foreground text-center">
        Dica: os relatórios podem ser exportados para <strong>Excel (.xlsx)</strong> ou impressos como <strong>PDF</strong> pelo diálogo do sistema.
      </div>
      {/* keep formatCurrency import used */}
      <div className="hidden">{formatCurrency(0)}</div>
    </div>
  );
}

function getColumns(key: ReportKey): ReportCol[] {
  switch (key) {
    case 'vendas':
      return [
        { key: 'dia', header: 'Data', format: 'date' },
        { key: 'pedidos', header: 'Pedidos', align: 'right', format: 'number' },
        { key: 'dinheiro', header: 'Dinheiro', align: 'right', format: 'currency' },
        { key: 'cartao', header: 'Cartão', align: 'right', format: 'currency' },
        { key: 'cheque', header: 'Cheque', align: 'right', format: 'currency' },
        { key: 'carne', header: 'Carnê', align: 'right', format: 'currency' },
        { key: 'ticket', header: 'Ticket', align: 'right', format: 'currency' },
        { key: 'total', header: 'Total', align: 'right', format: 'currency' },
      ];
    case 'produtos':
      return [
        { key: 'nome_produto', header: 'Produto' },
        { key: 'unidade', header: 'Un.', align: 'center' },
        { key: 'total_qtd', header: 'Qtd', align: 'right', format: 'number' },
        { key: 'vendas', header: 'Vendas', align: 'right', format: 'number' },
        { key: 'total_valor', header: 'Faturamento', align: 'right', format: 'currency' },
      ];
    case 'caixas':
      return [
        { key: 'data_abertura', header: 'Data', format: 'date' },
        { key: 'hora_abertura', header: 'Abertura' },
        { key: 'hora_fechamento', header: 'Fechamento' },
        { key: 'login', header: 'Operador' },
        { key: 'terminal', header: 'Terminal', align: 'center' },
        { key: 'pedidos', header: 'Pedidos', align: 'right', format: 'number' },
        { key: 'vr_abertura', header: 'Fundo', align: 'right', format: 'currency' },
        { key: 'total_vendas', header: 'Vendas', align: 'right', format: 'currency' },
        { key: 'vr_fechamento', header: 'Fechamento', align: 'right', format: 'currency' },
      ];
    case 'financeiro':
      return [
        { key: 'data_vencimento', header: 'Vencimento', format: 'date' },
        { key: 'plane_tipo', header: 'Tipo', align: 'center' },
        { key: 'historico', header: 'Descrição' },
        { key: 'plane_descricao', header: 'Plano de contas' },
        { key: 'nome_cliente', header: 'Cliente' },
        { key: 'vr_parcela', header: 'Valor', align: 'right', format: 'currency' },
        { key: 'data_confirmacao', header: 'Pago em', format: 'date' },
      ];
    case 'estoque_baixo':
      return [
        { key: 'nome_produto', header: 'Produto' },
        { key: 'cod_barra', header: 'Código' },
        { key: 'unidade', header: 'Un.', align: 'center' },
        { key: 'estoque', header: 'Estoque', align: 'right', format: 'number' },
        { key: 'min_estoque', header: 'Mínimo', align: 'right', format: 'number' },
        { key: 'vr_compra', header: 'Custo', align: 'right', format: 'currency' },
        { key: 'vr_venda', header: 'Venda', align: 'right', format: 'currency' },
      ];
  }
}
