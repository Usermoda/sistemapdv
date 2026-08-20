import { Navigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/stores/authStore';
import { PERMISSION_MODULES, type PermissionKey } from '@/lib/permissions';
import { Button } from '@/components/ui/button';

/**
 * Blocks a route if the current user doesn't have the required permission.
 * Behavior:
 *   - PDV-only users trying to access an ERP route → redirect to /pdv
 *   - Users with some ERP access but not this one → shows access denied with fallback
 */
export function PermissionGuard({ require, children }: { require: PermissionKey; children: React.ReactNode }) {
  const session = useAuth((s) => s.session);
  const permissions = useAuth((s) => s.permissions);
  const can = useAuth((s) => s.can);
  const logout = useAuth((s) => s.logout);

  if (!session || !permissions) return <Navigate to="/login" replace />;
  if (can(require)) return <>{children}</>;

  // If user only has PDV, send them there
  const nonPdvPerms = PERMISSION_MODULES.filter((m) => m.key !== 'pdv').some((m) => permissions[m.key]);
  if (permissions.pdv && !nonPdvPerms) {
    return <Navigate to="/pdv" replace />;
  }

  // Find first allowed module and redirect there
  const firstAllowed = PERMISSION_MODULES.find((m) => permissions[m.key] && m.key !== 'pdv');
  if (firstAllowed) {
    return <Navigate to={pathFor(firstAllowed.key)} replace />;
  }

  // No permissions at all → show a message
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="max-w-md text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-warning/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-warning" />
        </div>
        <h1 className="text-xl font-semibold">Sem acesso</h1>
        <p className="text-sm text-muted-foreground">
          Seu perfil ({session.nome_perfil}) não tem permissão para acessar este módulo. Peça a um administrador para revisar suas permissões.
        </p>
        <Button
          onClick={async () => {
            await logout();
            window.location.hash = '/login';
          }}
        >
          Sair
        </Button>
      </div>
    </div>
  );
}

function pathFor(key: PermissionKey): string {
  switch (key) {
    case 'pdv': return '/pdv';
    case 'dashboard': return '/erp';
    case 'produtos': return '/erp/produtos';
    case 'precos': return '/erp/precos';
    case 'clientes': return '/erp/clientes';
    case 'fornecedores': return '/erp/fornecedores';
    case 'estoque': return '/erp/estoque';
    case 'vendas': return '/erp/vendas';
    case 'financeiro': return '/erp/financeiro';
    case 'relatorios': return '/erp/relatorios';
    case 'etiquetas': return '/erp/etiquetas';
    case 'config': return '/erp/config';
  }
}
