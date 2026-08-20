import { useCallback, useEffect, useState } from 'react';
import { Package, Plus, Search, Edit, Power, PowerOff } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { ProdutoFormDialog } from './ProdutoFormDialog';
import { toast } from 'sonner';

type ProductRow = {
  id: number;
  nome_produto: string;
  cod_barra: string | null;
  unidade: string | null;
  vr_venda: number | null;
  vr_compra: number | null;
  estoque: number | null;
  min_estoque: number | null;
  inativo: number | null;
  nome_tipo?: string | null;
  id_tipo?: number | null;
  fracionado?: number | null;
};

export function ProdutosList() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.erp.products.list({ search, showInactive, limit: 200 });
      setRows(res.rows as ProductRow[]);
      setTotal(res.total);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setLoading(false);
  }, [search, showInactive]);

  useEffect(() => {
    const t = setTimeout(load, 180);
    return () => clearTimeout(t);
  }, [load]);

  const toggleActive = async (row: ProductRow) => {
    await api.erp.products.toggleActive(row.id, !row.inativo);
    toast.success(row.inativo ? 'Produto reativado' : 'Produto inativado');
    load();
  };

  const columns: Column<ProductRow>[] = [
    { key: 'id', header: 'ID', width: '70px', className: 'text-muted-foreground text-xs' },
    {
      key: 'nome_produto',
      header: 'Produto',
      cell: (r) => (
        <div>
          <div className="font-medium">{r.nome_produto}</div>
          {r.cod_barra && <div className="text-xs text-muted-foreground font-mono">{r.cod_barra}</div>}
        </div>
      ),
    },
    { key: 'nome_tipo', header: 'Categoria', cell: (r) => r.nome_tipo ?? '—' },
    { key: 'unidade', header: 'Un.', width: '60px' },
    {
      key: 'vr_venda',
      header: 'Venda',
      className: 'text-right tabular-nums',
      cell: (r) => <span className="font-semibold">{formatCurrency(r.vr_venda ?? 0)}</span>,
    },
    {
      key: 'estoque',
      header: 'Estoque',
      className: 'text-right tabular-nums',
      cell: (r) => {
        const est = r.estoque ?? 0;
        const min = r.min_estoque ?? 0;
        const low = min > 0 && est <= min;
        return <span className={low ? 'text-warning font-semibold' : ''}>{est.toFixed(0)}</span>;
      },
    },
    {
      key: 'actions',
      header: '',
      width: '110px',
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); toggleActive(r); }}>
            {r.inativo ? <PowerOff className="w-4 h-4 text-muted-foreground" /> : <Power className="w-4 h-4 text-success" />}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-8">
      <PageHeader
        title="Produtos"
        description={`${total} produtos ${showInactive ? 'no total' : 'ativos'}`}
        actions={
          <Button size="lg" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" /> Novo produto
          </Button>
        }
      />

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, código de barras..." className="pl-9" />
        </div>
        <Button variant={showInactive ? 'default' : 'outline'} onClick={() => setShowInactive((v) => !v)}>
          {showInactive ? 'Mostrando inativos' : 'Somente ativos'}
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        onRowClick={(r) => setEditing(r)}
        getKey={(r) => r.id}
        emptyMessage={
          search
            ? `Nenhum produto para "${search}"`
            : rows.length === 0
            ? 'Cadastre seu primeiro produto'
            : ''
        }
      />

      {(creating || editing) && (
        <ProdutoFormDialog
          initial={editing ?? undefined}
          open={creating || !!editing}
          onOpenChange={(o) => {
            if (!o) {
              setCreating(false);
              setEditing(null);
            }
          }}
          onSaved={() => {
            // Refresh the list but keep the dialog open so the user can
            // continue tweaking codes/fornecedores without reopening.
            load();
          }}
        />
      )}
    </div>
  );
}
