export type PermissionKey =
  | 'pdv'
  | 'dashboard'
  | 'produtos'
  | 'precos'
  | 'clientes'
  | 'fornecedores'
  | 'estoque'
  | 'vendas'
  | 'financeiro'
  | 'relatorios'
  | 'etiquetas'
  | 'config';

export type PermissionMap = Record<PermissionKey, boolean>;

export const PERMISSION_MODULES: Array<{ key: PermissionKey; label: string; description: string }> = [
  { key: 'pdv', label: 'PDV (vendas)', description: 'Abrir e operar o caixa' },
  { key: 'dashboard', label: 'Dashboard', description: 'Visão geral e KPIs' },
  { key: 'produtos', label: 'Produtos', description: 'CRUD de produtos e categorias' },
  { key: 'precos', label: 'Preços e promoções', description: 'Edição em massa e campanhas' },
  { key: 'clientes', label: 'Clientes', description: 'Cadastro de clientes' },
  { key: 'fornecedores', label: 'Fornecedores', description: 'Cadastro de fornecedores' },
  { key: 'estoque', label: 'Estoque', description: 'Entradas e histórico' },
  { key: 'vendas', label: 'Histórico de vendas', description: 'Consultar vendas anteriores' },
  { key: 'financeiro', label: 'Financeiro', description: 'Contas a pagar/receber' },
  { key: 'relatorios', label: 'Relatórios', description: 'Análises e exportações' },
  { key: 'etiquetas', label: 'Etiquetas', description: 'Impressão de etiquetas' },
  { key: 'config', label: 'Configurações', description: 'Ajustes gerais e usuários' },
];

const ALL_KEYS = PERMISSION_MODULES.map((p) => p.key);

export const PROFILE_TEMPLATES: Array<{ name: string; description: string; perms: PermissionMap }> = [
  {
    name: 'CAIXA',
    description: 'Somente PDV. Abre direto na tela de vendas.',
    perms: makeMap({ pdv: true }),
  },
  {
    name: 'GERENTE',
    description: 'Acesso total exceto configurações do sistema.',
    perms: makeMap({
      pdv: true, dashboard: true, produtos: true, clientes: true, fornecedores: true,
      estoque: true, vendas: true, financeiro: true, relatorios: true, etiquetas: true,
    }),
  },
  {
    name: 'ESTOQUISTA',
    description: 'Cadastro de produtos, estoque e etiquetas.',
    perms: makeMap({ produtos: true, fornecedores: true, estoque: true, etiquetas: true, relatorios: true }),
  },
  {
    name: 'VENDEDOR',
    description: 'PDV + consulta de vendas e clientes.',
    perms: makeMap({ pdv: true, vendas: true, clientes: true }),
  },
];

function makeMap(partial: Partial<PermissionMap>): PermissionMap {
  const out = {} as PermissionMap;
  for (const k of ALL_KEYS) out[k] = !!partial[k];
  return out;
}

/**
 * Parses menu_options. Supports:
 *   - JSON object: {"pdv":true,"config":false,...}
 *   - Legacy "SSSSSS..." string (each S = allow, N = deny) — treat as full admin if all S
 */
export function parsePermissions(menuOptions: string | null | undefined): PermissionMap {
  const raw = (menuOptions ?? '').trim();
  if (!raw) return makeMap({});
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as Partial<Record<string, boolean>>;
      return makeMap(parsed as Partial<PermissionMap>);
    } catch {
      return makeMap({});
    }
  }
  // Legacy: uppercase S/N string. If mostly S, treat as full admin.
  const asString = raw.toUpperCase();
  if (asString.length > 0 && asString.replace(/[^S]/g, '').length >= asString.length * 0.5) {
    return allTrue();
  }
  return makeMap({});
}

export function serializePermissions(perms: PermissionMap): string {
  return JSON.stringify(perms);
}

export function allTrue(): PermissionMap {
  const out = {} as PermissionMap;
  for (const k of ALL_KEYS) out[k] = true;
  return out;
}

export function hasOnly(perms: PermissionMap, keys: PermissionKey[]): boolean {
  for (const k of ALL_KEYS) {
    const shouldHave = keys.includes(k);
    if (perms[k] !== shouldHave) return false;
  }
  return true;
}

export function isPdvOnly(perms: PermissionMap): boolean {
  return perms.pdv && ALL_KEYS.filter((k) => k !== 'pdv').every((k) => !perms[k]);
}
