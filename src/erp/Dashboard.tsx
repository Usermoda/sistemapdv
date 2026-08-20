import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Package, ShoppingBag, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

type Stats = {
  today: { total: number; pedidos: number };
  month: { total: number; pedidos: number };
  productCount: number;
  clientCount: number;
  dailyChart: Array<{ dia: string; total: number }>;
  topProducts: Array<{ nome_produto: string; total_qtd: number; total_valor: number }>;
};

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.erp
      .dashboard()
      .then((s) => setStats(s as Stats))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    {
      label: 'Vendas hoje',
      value: formatCurrency(stats?.today.total ?? 0),
      sub: `${stats?.today.pedidos ?? 0} pedidos`,
      icon: DollarSign,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      label: 'Vendas do mês',
      value: formatCurrency(stats?.month.total ?? 0),
      sub: `${stats?.month.pedidos ?? 0} pedidos`,
      icon: TrendingUp,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Produtos ativos',
      value: String(stats?.productCount ?? 0),
      icon: Package,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      label: 'Clientes ativos',
      value: String(stats?.clientCount ?? 0),
      icon: Users,
      color: 'text-accent',
      bg: 'bg-accent/10',
    },
  ];

  const chartMax = Math.max(1, ...(stats?.dailyChart.map((d) => Number(d.total)) ?? [1]));

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral do seu comércio</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="h-full">
              <Card className="h-full flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardDescription>{c.label}</CardDescription>
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', c.bg)}>
                    <Icon className={cn('w-4 h-4', c.color)} />
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-end">
                  <div className="text-3xl font-bold tabular-nums">{loading ? '—' : c.value}</div>
                  <p className="text-xs text-muted-foreground mt-1 min-h-[1rem]">{c.sub ?? ''}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Vendas últimos 7 dias</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-muted-foreground text-sm">Carregando...</div>
            ) : (stats?.dailyChart.length ?? 0) === 0 ? (
              <div className="text-muted-foreground text-sm py-6 text-center">
                Nenhuma venda registrada nos últimos 7 dias
              </div>
            ) : (
              <div className="flex items-end gap-2 h-40 pt-4">
                {stats?.dailyChart.map((d) => {
                  const height = (Number(d.total) / chartMax) * 100;
                  const day = new Date(d.dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                  return (
                    <div key={d.dia} className="flex-1 flex flex-col items-center gap-1 group">
                      <div className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition tabular-nums">
                        {formatCurrency(Number(d.total))}
                      </div>
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ duration: 0.6 }}
                        className="w-full min-h-[4px] rounded-t-md bg-gradient-to-t from-primary to-accent"
                      />
                      <div className="text-[10px] text-muted-foreground">{day}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top produtos (30 dias)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="text-muted-foreground text-sm">Carregando...</div>
            ) : (stats?.topProducts.length ?? 0) === 0 ? (
              <div className="text-muted-foreground text-sm py-6 text-center">Sem vendas recentes</div>
            ) : (
              stats?.topProducts.map((p, i) => (
                <div key={p.nome_produto} className="flex items-center gap-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.nome_produto}</div>
                    <div className="text-[11px] text-muted-foreground">{Number(p.total_qtd).toFixed(0)} vendidos</div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{formatCurrency(Number(p.total_valor))}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
