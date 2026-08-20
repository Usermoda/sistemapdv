import { createHashRouter, Navigate } from 'react-router-dom';
import { SetupWizard } from './setup/SetupWizard';
import { AppShell } from './pages/AppShell';
import { Dashboard } from './erp/Dashboard';
import { PdvSales } from './pdv/PdvSales';
import { SetupGuard } from './setup/SetupGuard';
import { AuthGuard } from './auth/AuthGuard';
import { PermissionGuard } from './auth/PermissionGuard';
import { LoginPage } from './auth/LoginPage';
import { ProdutosList } from './erp/produtos/ProdutosList';
import { ClientesList } from './erp/clientes/ClientesList';
import { VendasList } from './erp/vendas/VendasList';
import { FornecedoresList } from './erp/fornecedores/FornecedoresList';
import { EstoquePage } from './erp/estoque/EstoquePage';
import { NFeImportPage } from './erp/nfe/NFeImportPage';
import { FinanceiroPage } from './erp/financeiro/FinanceiroPage';
import { ConfiguracoesPage } from './erp/config/ConfiguracoesPage';
import { RelatoriosPage } from './erp/relatorios/RelatoriosPage';
import { EtiquetasPage } from './erp/etiquetas/EtiquetasPage';
import { PrecosPage } from './erp/precos/PrecosPage';

export const router = createHashRouter([
  {
    path: '/setup/*',
    element: <SetupWizard />,
  },
  {
    path: '/login',
    element: (
      <SetupGuard>
        <LoginPage />
      </SetupGuard>
    ),
  },
  {
    path: '/pdv',
    element: (
      <SetupGuard>
        <AuthGuard>
          <PermissionGuard require="pdv">
            <PdvSales />
          </PermissionGuard>
        </AuthGuard>
      </SetupGuard>
    ),
  },
  {
    path: '/',
    element: (
      <SetupGuard>
        <AuthGuard>
          <AppShell />
        </AuthGuard>
      </SetupGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/erp" replace /> },
      { path: 'erp', element: <PermissionGuard require="dashboard"><Dashboard /></PermissionGuard> },
      { path: 'erp/produtos', element: <PermissionGuard require="produtos"><ProdutosList /></PermissionGuard> },
      { path: 'erp/precos', element: <PermissionGuard require="precos"><PrecosPage /></PermissionGuard> },
      { path: 'erp/clientes', element: <PermissionGuard require="clientes"><ClientesList /></PermissionGuard> },
      { path: 'erp/fornecedores', element: <PermissionGuard require="fornecedores"><FornecedoresList /></PermissionGuard> },
      { path: 'erp/estoque', element: <PermissionGuard require="estoque"><EstoquePage /></PermissionGuard> },
      { path: 'erp/nfe-entrada', element: <PermissionGuard require="estoque"><NFeImportPage /></PermissionGuard> },
      { path: 'erp/vendas', element: <PermissionGuard require="vendas"><VendasList /></PermissionGuard> },
      { path: 'erp/financeiro', element: <PermissionGuard require="financeiro"><FinanceiroPage /></PermissionGuard> },
      { path: 'erp/relatorios', element: <PermissionGuard require="relatorios"><RelatoriosPage /></PermissionGuard> },
      { path: 'erp/etiquetas', element: <PermissionGuard require="etiquetas"><EtiquetasPage /></PermissionGuard> },
      { path: 'erp/config', element: <PermissionGuard require="config"><ConfiguracoesPage /></PermissionGuard> },
    ],
  },
]);
