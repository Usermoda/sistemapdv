import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, User, UserX } from 'lucide-react';
import { api } from '@/lib/api';
import { usePdv } from '@/stores/pdvStore';

export function ClientPickerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<{ id: number; nome_cliente: string; cpf_cnpj: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const setCliente = usePdv((s) => s.setCliente);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        setResults((await api.pdv.searchClients(q)) as typeof results);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [q, open]);

  const pick = (c: (typeof results)[number]) => {
    setCliente({ id: c.id, nome_cliente: c.nome_cliente, cpf_cnpj: c.cpf_cnpj });
    onOpenChange(false);
    setQ('');
  };

  const clear = () => {
    setCliente(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Selecionar Cliente</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome, CPF/CNPJ..."
            className="pl-9 h-12"
          />
        </div>
        <div className="max-h-72 overflow-auto space-y-1">
          {loading && <div className="text-sm text-muted-foreground p-3">Buscando...</div>}
          {!loading && results.length === 0 && q && (
            <div className="text-sm text-muted-foreground p-3">Nenhum cliente encontrado</div>
          )}
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => pick(c)}
              className="w-full text-left p-3 rounded-lg hover:bg-secondary transition flex items-center gap-3 touch-target"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{c.nome_cliente}</div>
                {c.cpf_cnpj && <div className="text-xs text-muted-foreground">{c.cpf_cnpj}</div>}
              </div>
            </button>
          ))}
        </div>
        <button
          onClick={clear}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-white/5 hover:bg-secondary text-sm text-muted-foreground touch-target"
        >
          <UserX className="w-4 h-4" /> Venda sem cliente identificado
        </button>
      </DialogContent>
    </Dialog>
  );
}
