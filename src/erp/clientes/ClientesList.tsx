import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Edit, Power, PowerOff, User } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { ClienteFormDialog } from './ClienteFormDialog';
import { toast } from 'sonner';

type ClientRow = {
  id: number;
  nome_cliente: string;
  cpf_cnpj: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  inativo: number | null;
};

export function ClientesList() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.erp.clients.list({ search, showInactive, limit: 200 });
      setRows(res.rows as ClientRow[]);
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

  const toggleActive = async (row: ClientRow) => {
    await api.erp.clients.toggleActive(row.id, !row.inativo);
    toast.success(row.inativo ? 'Cliente reativado' : 'Cliente inativado');
    load();
  };

  const columns: Column<ClientRow>[] = [
    { key: 'id', header: 'ID', width: '70px', className: 'text-muted-foreground text-xs' },
    {
      key: 'nome_cliente',
      header: 'Cliente',
      cell: (r) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="font-medium">{r.nome_cliente}</div>
            {r.cpf_cnpj && <div className="text-xs text-muted-foreground">{r.cpf_cnpj}</div>}
          </div>
        </div>
      ),
    },
    { key: 'telefone', header: 'Telefone', cell: (r) => r.telefone ?? '—' },
    {
      key: 'cidade',
      header: 'Cidade',
      cell: (r) => (r.cidade ? `${r.cidade}${r.uf ? ' - ' + r.uf : ''}` : '—'),
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
        title="Clientes"
        description={`${total} clientes ${showInactive ? 'no total' : 'ativos'}`}
        actions={<Button size="lg" onClick={() => setCreating(true)}><Plus className="w-4 h-4" /> Novo cliente</Button>}
      />

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, CPF/CNPJ, telefone..." className="pl-9" />
        </div>
        <Button variant={showInactive ? 'default' : 'outline'} onClick={() => setShowInactive((v) => !v)}>
          {showInactive ? 'Mostrando inativos' : 'Somente ativos'}
        </Button>
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={(r) => setEditing(r)} getKey={(r) => r.id} />

      {(creating || editing) && (
        <ClienteFormDialog
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
