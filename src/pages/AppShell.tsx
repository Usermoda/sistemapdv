import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Users, Warehouse, Wallet, FileText, Settings, LogOut, Truck, UserCircle2, FileBarChart, Moon, Sun, Tag, FileInput, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BipaMark, BipaWordmark } from '@/components/BipaLogo';
import { UpdateBanner } from '@/components/UpdateBanner';
import { useAuth } from '@/stores/authStore';
import { useTheme } from '@/stores/themeStore';
import type { PermissionKey } from '@/lib/permissions';

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; perm: PermissionKey };

const nav: NavItem[] = [
  { to: '/erp', label: 'Dashboard', icon: LayoutDashboard, end: true, perm: 'dashboard' },
  { to: '/erp/produtos', label: 'Produtos', icon: Package, perm: 'produtos' },
  { to: '/erp/precos', label: 'Preços e promoções', icon: DollarSign, perm: 'precos' },
  { to: '/erp/clientes', label: 'Clientes', icon: Users, perm: 'clientes' },
  { to: '/erp/fornecedores', label: 'Fornecedores', icon: Truck, perm: 'fornecedores' },
  { to: '/erp/estoque', label: 'Ajuste de estoque', icon: Warehouse, perm: 'estoque' },
  { to: '/erp/nfe-entrada', label: 'Entrada por NF-e', icon: FileInput, perm: 'estoque' },
  { to: '/erp/financeiro', label: 'Financeiro', icon: Wallet, perm: 'financeiro' },
  { to: '/erp/vendas', label: 'Vendas', icon: FileText, perm: 'vendas' },
  { to: '/erp/etiquetas', label: 'Etiquetas', icon: Tag, perm: 'etiquetas' },
  { to: '/erp/relatorios', label: 'Relatórios', icon: FileBarChart, perm: 'relatorios' },
  { to: '/erp/config', label: 'Configurações', icon: Settings, perm: 'config' },
];

export function AppShell() {
  const navigate = useNavigate();
  const can = useAuth((s) => s.can);
  const visibleNav = nav.filter((n) => can(n.perm));
  const canPdv = can('pdv');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (inField) return;
      if (e.key === 'F9') {
        e.preventDefault();
        navigate('/pdv');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="h-screen flex bg-background">
      <aside className="w-64 flex-shrink-0 border-r border-white/5 bg-black/20 flex flex-col">
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <BipaMark size={36} />
            <div>
              <BipaWordmark className="text-xl" />
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Painel ERP</div>
            </div>
          </div>
        </div>

        <nav className="p-3 flex-1 overflow-auto">
          {visibleNav.map((n) => {
            const Icon = n.icon;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors touch-target',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  )
                }
              >
                <Icon className="w-4 h-4" />
                {n.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/5 space-y-2">
          <UserBar />
          {canPdv && (
            <Button className="w-full" size="lg" onClick={() => navigate('/pdv')}>
              <ShoppingCart className="w-4 h-4" />
              Abrir PDV
              <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-primary-foreground/20 font-mono">F9</kbd>
            </Button>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <UpdateBanner />
    </div>
  );
}

function UserBar() {
  const session = useAuth((s) => s.session);
  const logout = useAuth((s) => s.logout);
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);
  const navigate = useNavigate();
  if (!session) return null;
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-black/20 dark:bg-black/20 bg-secondary">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <UserCircle2 className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{session.login}</div>
        <div className="text-[10px] text-muted-foreground truncate">{session.nome_perfil || 'Usuário'}</div>
      </div>
      <Button variant="ghost" size="icon" onClick={toggleTheme} title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}>
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={async () => {
          await logout();
          navigate('/login');
        }}
        title="Sair"
      >
        <LogOut className="w-4 h-4" />
      </Button>
    </div>
  );
}
