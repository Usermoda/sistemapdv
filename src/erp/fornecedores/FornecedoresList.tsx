import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Edit, Truck } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { FornecedorFormDialog } from './FornecedorFormDialog';
import { toast } from 'sonner';

type SupplierRow = {
  id: number;
  nome_fornecedor: string;
  cpf_cnpj: string | null;
  contato: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  inativo: number | null;
};

export function FornecedoresList() {
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.erp.suppliers.list({ search, limit: 200 });
      setRows(res.rows as SupplierRow[]);
      setTotal(res.total);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 180);
    return () => clearTimeout(t);
  }, [load]);

  const columns: Column<SupplierRow>[] = [
    { key: 'id', header: 'ID', width: '70px', className: 'text-muted-foreground text-xs' },
    {
      key: 'nome_fornecedor',
      header: 'Fornecedor',
      cell: (r) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Truck className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="font-medium">{r.nome_fornecedor}</div>
            {r.cpf_cnpj && <div className="text-xs text-muted-foreground">{r.cpf_cnpj}</div>}
          </div>
        </div>
      ),
    },
    { key: 'contato', header: 'Contato', cell: (r) => r.contato ?? '—' },
    { key: 'telefone', header: 'Telefone', cell: (r) => r.telefone ?? '—' },
    { key: 'cidade', header: 'Cidade', cell: (r) => (r.cidade ? `${r.cidade}${r.uf ? ' - ' + r.uf : ''}` : '—') },
    {
      key: 'actions',
      header: '',
      width: '60px',
      cell: (r) => (
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditing(r); }}>
          <Edit className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="p-8">
      <PageHeader
        title="Fornecedores"
        description={`${total} fornecedores cadastrados`}
        actions={<Button size="lg" onClick={() => setCreating(true)}><Plus className="w-4 h-4" /> Novo fornecedor</Button>}
      />

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, CNPJ..." className="pl-9" />
        </div>
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => setEditing(r)} getKey={(r) => r.id} />

      {(creating || editing) && (
        <FornecedorFormDialog
          initial={editing ?? undefined}
          open={creating || !!editing}
          onOpenChange={(o) => {
            if (!o) {
              setCreating(false);
              setEditing(null);
            }
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
