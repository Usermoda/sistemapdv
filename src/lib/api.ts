export type SetupStatus = {
  dbConfigured: boolean;
  companyConfigured: boolean;
  printerConfigured: boolean;
  setupComplete: boolean;
  mode: 'server' | 'terminal';
};

export type NFeItem = {
  n: number;
  cProd: string;
  cEAN: string | null;
  xProd: string;
  NCM: string | null;
  CFOP: string | null;
  uCom: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
  CEST?: string | null;
  origem?: number;
};

export type NFeParsed = {
  chave: string | null;
  numero: string;
  serie: string;
  dataEmissao: string;
  emitente: {
    CNPJ: string;
    xNome: string;
    xFant?: string;
    IE?: string;
    xLgr?: string;
    nro?: string;
    xBairro?: string;
    xMun?: string;
    UF?: string;
    CEP?: string;
    fone?: string;
  };
  destinatarioCNPJ: string | null;
  items: NFeItem[];
  totalProdutos: number;
  totalDesconto: number;
  totalFrete: number;
  totalNota: number;
};

export type ConnectionConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
};

export type CompanyData = {
  nome_empresa: string;
  cpf_cpnj?: string;
  rg_ie?: string;
  im?: string;
  cep?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  email?: string;
  site?: string;
  telefone?: string;
  fax?: string;
  simbolo_monetario?: string;
  casas_decimais?: number;
  max_desc?: number;
  qtd_turnos?: string;
  qtd_terminal?: number;
};

export type PrinterConfig = {
  type: 'usb' | 'network' | 'serial';
  interface: string;
  name?: string;
  width?: 48 | 32;
  drawerEnabled?: boolean;
  drawerCode?: number;
  autoPreview?: 'always' | 'when-no-printer' | 'never';
};

declare global {
  interface Window {
    api?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      on: (channel: string, cb: (...args: unknown[]) => void) => () => void;
    };
  }
}

export const isElectron = () => typeof window !== 'undefined' && !!window.api;

const invoke = <T,>(channel: string, ...args: unknown[]): Promise<T> => {
  if (!window.api) {
    return Promise.reject(
      new Error(
        'Ponte com o Electron não disponível. Abra o app pela janela do Electron (npm run dev), não pelo navegador.'
      )
    );
  }
  return window.api.invoke(channel, ...args) as Promise<T>;
};

export const api = {
  getSetupStatus: () => invoke<SetupStatus>('app:get-setup-status'),
  setSetupMode: (mode: 'server' | 'terminal') => invoke<{ ok: boolean }>('app:set-setup-mode', mode),
  quit: () => invoke<void>('app:quit'),
  getAutoStart: () => invoke<{ enabled: boolean }>('app:get-auto-start'),
  setAutoStart: (enabled: boolean) => invoke<{ ok: boolean }>('app:set-auto-start', enabled),
  createShortcut: () => invoke<{ ok: boolean; error?: string; path?: string }>('app:create-shortcut'),
  addFirewallRule: (port: number, name?: string) =>
    invoke<{ ok: boolean; error?: string }>('system:add-firewall-rule', { port, name }),
  removeFirewallRule: (name?: string) =>
    invoke<{ ok: boolean; error?: string }>('system:remove-firewall-rule', { name }),

  db: {
    detect: (port?: number) =>
      invoke<{
        installed: boolean;
        running: boolean;
        port: number;
        version?: string;
        serviceName?: string;
        bundled: boolean;
        canAutoInstall: boolean;
        hint?: string;
      }>('db:detect-mysql', port),
    installBundled: () => invoke<{ ok: boolean; error?: string; port?: number }>('db:install-bundled'),
    startBundled: (port?: number) => invoke<{ ok: boolean; error?: string }>('db:start-bundled', port),
    onInstallBundledProgress: (cb: (u: { phase: 'download' | 'extract' | 'init' | 'start'; msg: string; pct: number }) => void) => {
      if (!window.api) return () => undefined;
      return window.api.on('db:install-bundled-progress', (u) =>
        cb(u as { phase: 'download' | 'extract' | 'init' | 'start'; msg: string; pct: number })
      );
    },
    test: (cfg: ConnectionConfig) =>
      invoke<{ ok: boolean; error?: string; version?: string; innodb?: boolean }>('db:test-connection', cfg),
    listDatabases: (cfg: ConnectionConfig) => invoke<string[]>('db:list-databases', cfg),
    createDatabase: (cfg: ConnectionConfig, name: string) => invoke<{ ok: boolean }>('db:create-database', cfg, name),
    installSchema: (cfg: ConnectionConfig, database: string) => invoke<{ statements: number }>('db:install-schema', cfg, database),
    saveConfig: (cfg: ConnectionConfig & { database: string }) => invoke<{ ok: boolean }>('db:save-config', cfg),
    onInstallProgress: (cb: (data: { msg: string; pct: number }) => void) => {
      if (!window.api) return () => undefined;
      return window.api.on('db:install-progress', (data) => cb(data as { msg: string; pct: number }));
    },
    query: <T,>(sql: string, params?: unknown[]) => invoke<T>('db:query', sql, params),
    setLanSharing: (enabled: boolean) =>
      invoke<{ ok: boolean; enabled?: boolean; port?: number; lanIps?: string[]; error?: string }>('db:set-lan-sharing', enabled),
    getLanInfo: () =>
      invoke<{ shareOnLan: boolean; bundled: boolean; port: number; lanIps: string[] }>('db:get-lan-info'),
  },

  setup: {
    saveCompany: (data: CompanyData) => invoke<{ ok: boolean; id: number }>('setup:save-company', data),
    getCompany: () => invoke<CompanyData | null>('setup:get-company'),
    complete: () => invoke<{ ok: boolean }>('setup:complete'),
  },

  printer: {
    list: () => invoke<string[]>('printer:list'),
    saveConfig: (cfg: PrinterConfig) => invoke<{ ok: boolean }>('printer:save-config', cfg),
    getConfig: () => invoke<PrinterConfig & { configured: boolean; autoPreview: 'always' | 'when-no-printer' | 'never' }>('printer:get-config'),
    testPrint: (cfg: PrinterConfig, companyName?: string) =>
      invoke<{ ok: boolean; error?: string }>('printer:test-print', cfg, companyName),
    openDrawer: () => invoke<{ ok: boolean; error?: string }>('printer:open-drawer'),
  },

  hardware: {
    listSerialPorts: () =>
      invoke<Array<{ path: string; manufacturer?: string; friendlyName?: string }>>('hardware:list-serial-ports'),
    testScale: (args: { port: string; baudRate?: number; protocol?: 'toledo' | 'filizola' | 'urano' | 'generic'; save?: boolean }) =>
      invoke<{ ok: boolean; weight?: number; raw?: string; error?: string }>('hardware:test-scale', args),
    readScale: () => invoke<{ ok: boolean; weight?: number; raw?: string; error?: string }>('hardware:read-scale'),
    getStatus: () =>
      invoke<{ scaleEnabled: boolean; drawerEnabled: boolean; printerConfigured: boolean }>('hardware:get-status'),
  },

  reports: {
    salesByPeriod: (args: { from: string; to: string }) =>
      invoke<{
        rows: Array<{ dia: string; pedidos: number; total: number; dinheiro: number; cartao: number; cheque: number; carne: number; ticket: number }>;
        total: { pedidos: number; total: number; ticket_medio: number };
      }>('reports:sales-by-period', args),
    topProducts: (args: { from: string; to: string; limit?: number }) =>
      invoke<Array<{ id: number; nome_produto: string; unidade: string; total_qtd: number; total_valor: number; vendas: number }>>('reports:top-products', args),
    cashierClosures: (args: { from: string; to: string }) =>
      invoke<Array<{ id: number; data_abertura: string; data_fechamento: string | null; hora_abertura: string; hora_fechamento: string | null; vr_abertura: number; vr_fechamento: number; login: string | null; terminal: string; total_vendas: number; pedidos: number; status_caixa: string }>>('reports:cashier-closures', args),
    paymentBreakdown: (args: { from: string; to: string }) =>
      invoke<{ dinheiro: number; cartao: number; cheque: number; carne: number; ticket: number; total: number }>('reports:payment-breakdown', args),
    finance: (args: { from: string; to: string; tipo?: 'E' | 'S' | 'all' }) =>
      invoke<Array<{ id: number; data_vencimento: string; data_confirmacao: string | null; vr_parcela: number; historico: string | null; plane_descricao: string | null; plane_tipo: 'E' | 'S' | null; conta_descricao: string | null; nome_cliente: string | null }>>('reports:finance', args),
    lowStock: () =>
      invoke<Array<{ id: number; nome_produto: string; cod_barra: string | null; unidade: string; estoque: number; min_estoque: number; vr_venda: number; vr_compra: number }>>('reports:low-stock'),
  },

  backup: {
    getSettings: () =>
      invoke<{
        enabled: boolean;
        hour: number;
        minute: number;
        keepDays: number;
        customPath: string;
        lastRun: string | null;
      }>('backup:get-settings'),
    saveSettings: (s: {
      enabled: boolean;
      hour: number;
      minute: number;
      keepDays: number;
      customPath: string;
      lastRun: string | null;
    }) => invoke<{ ok: boolean }>('backup:save-settings', s),
    runNow: () => invoke<{ ok: boolean; path?: string; error?: string; size?: number }>('backup:run-now'),
    list: () =>
      invoke<Array<{ name: string; path: string; size: number; created: number }>>('backup:list'),
    restore: (backupPath: string) => invoke<{ ok: boolean; error?: string }>('backup:restore', backupPath),
    delete: (name: string) => invoke<{ ok: boolean }>('backup:delete', name),
    openFolder: () => invoke<{ ok: boolean }>('backup:open-folder'),
    chooseFolder: () => invoke<string | null>('backup:choose-folder'),
  },

  auth: {
    login: (args: { login: string; password: string }) =>
      invoke<{
        ok: boolean;
        error?: string;
        session?: { id: number; login: string; id_perfil: number; nome_perfil: string; menu_options: string; loginAt: number };
      }>('auth:login', args),
    logout: () => invoke<{ ok: boolean }>('auth:logout'),
    current: () =>
      invoke<{ id: number; login: string; id_perfil: number; nome_perfil: string; menu_options: string; loginAt: number } | null>(
        'auth:current'
      ),
    listUsers: () =>
      invoke<Array<{ id: number; login: string; id_perfil: number; nome_perfil: string; inativo: number | null }>>('auth:list-users'),
    listProfiles: () =>
      invoke<Array<{ id_perfil: number; nome_perfil: string; menu_options: string; users: number }>>('auth:list-profiles'),
    saveProfile: (data: { id_perfil?: number; nome_perfil: string; menu_options?: string }) =>
      invoke<{ id_perfil: number }>('auth:save-profile', data),
    deleteProfile: (id_perfil: number) => invoke<{ ok: boolean }>('auth:delete-profile', id_perfil),
    saveUser: (data: { id?: number; login: string; id_perfil: number; senha?: string; inativo?: number }) =>
      invoke<{ id: number }>('auth:save-user', data),
    changePassword: (args: { userId: number; newPassword: string }) =>
      invoke<{ ok: boolean }>('auth:change-password', args),
  },

  erp: {
    products: {
      list: (args?: { search?: string; limit?: number; offset?: number; showInactive?: boolean }) =>
        invoke<{ rows: Array<Record<string, unknown>>; total: number }>('erp:products:list', args ?? {}),
      get: (id: number) => invoke<Record<string, unknown> | null>('erp:products:get', id),
      save: (data: Record<string, unknown>) => invoke<{ id: number; ok: boolean }>('erp:products:save', data),
      toggleActive: (id: number, inativo: boolean) =>
        invoke<{ ok: boolean }>('erp:products:toggle-active', id, inativo),
      categories: () => invoke<Array<{ id: number; nome_tipo: string }>>('erp:products:categories'),
      saveCategory: (data: { id?: number; nome_tipo: string }) =>
        invoke<{ id: number }>('erp:products:save-category', data),
      getSuppliers: (id_produto: number) =>
        invoke<Array<{ id: number; nome_fornecedor: string; cpf_cnpj: string | null; contato: string | null; telefone: string | null }>>('erp:products:get-suppliers', id_produto),
      setSuppliers: (args: { id_produto: number; supplier_ids: number[] }) =>
        invoke<{ ok: boolean }>('erp:products:set-suppliers', args),
      listCodes: (id_produto: number) =>
        invoke<Array<{
          id: number;
          id_produto: number;
          tipo: string;
          codigo: string;
          embalagem: string | null;
          fator: number;
          id_fornecedor: number | null;
          nome_fornecedor: string | null;
          util_venda: number;
          preferencial: number;
          data_inicio: string | null;
          inativo: number;
        }>>('erp:products:list-codes', id_produto),
      saveCode: (data: {
        id?: number;
        id_produto: number;
        tipo: string;
        codigo: string;
        embalagem?: string | null;
        fator?: number;
        id_fornecedor?: number | null;
        util_venda?: number;
        preferencial?: number;
        data_inicio?: string | null;
        inativo?: number;
      }) => invoke<{ id: number }>('erp:products:save-code', data),
      deleteCode: (id: number) => invoke<{ ok: boolean }>('erp:products:delete-code', id),
    },
    clients: {
      list: (args?: { search?: string; limit?: number; offset?: number; showInactive?: boolean }) =>
        invoke<{ rows: Array<Record<string, unknown>>; total: number }>('erp:clients:list', args ?? {}),
      get: (id: number) => invoke<Record<string, unknown> | null>('erp:clients:get', id),
      save: (data: Record<string, unknown>) => invoke<{ id: number; ok: boolean }>('erp:clients:save', data),
      toggleActive: (id: number, inativo: boolean) =>
        invoke<{ ok: boolean }>('erp:clients:toggle-active', id, inativo),
    },
    suppliers: {
      list: (args?: { search?: string; limit?: number; offset?: number; showInactive?: boolean }) =>
        invoke<{ rows: Array<Record<string, unknown>>; total: number }>('erp:suppliers:list', args ?? {}),
      save: (data: Record<string, unknown>) => invoke<{ id: number; ok: boolean }>('erp:suppliers:save', data),
      getProducts: (id_fornecedor: number) =>
        invoke<Array<{ id: number; nome_produto: string; cod_barra: string | null; unidade: string | null; vr_venda: number | null; estoque: number | null }>>('erp:suppliers:get-products', id_fornecedor),
      setProducts: (args: { id_fornecedor: number; product_ids: number[] }) =>
        invoke<{ ok: boolean }>('erp:suppliers:set-products', args),
    },
    sales: {
      list: (args?: { from?: string; to?: string; search?: string; limit?: number; offset?: number }) =>
        invoke<Array<Record<string, unknown>>>('erp:sales:list', args ?? {}),
      get: (id: number) =>
        invoke<{ header: Record<string, unknown>; items: Array<Record<string, unknown>> } | null>('erp:sales:get', id),
    },
    paymentMethods: {
      list: () =>
        invoke<Array<{ id: number; modo_lancamento: string; protegido: string | null; inativo: number }>>('erp:payment-methods:list'),
      save: (data: { id?: number; modo_lancamento: string }) =>
        invoke<{ id: number }>('erp:payment-methods:save', data),
      delete: (id: number) => invoke<{ ok: boolean }>('erp:payment-methods:delete', id),
      toggleActive: (id: number, inativo: boolean) =>
        invoke<{ ok: boolean }>('erp:payment-methods:toggle-active', id, inativo),
    },
    stock: {
      history: (args?: { from?: string; to?: string; id_produto?: number; tipo?: 'N' | 'A' | 'S' | 'I' | 'all'; limit?: number }) =>
        invoke<Array<Record<string, unknown>>>('erp:stock:history', args ?? {}),
      entry: (args: {
        id_produto: number;
        id_fornecedor?: number;
        quantidade: number;
        valor?: number;
        nota_entrada?: string;
        data_entrada?: string;
      }) => invoke<{ ok: boolean }>('erp:stock:entry', args),
      adjust: (args: {
        id_produto: number;
        tipo: 'A' | 'S' | 'I';
        quantidade: number;
        motivo: string;
        data_entrada?: string;
      }) => invoke<{ ok: boolean; delta: number; newStock: number }>('erp:stock:adjust', args),
      low: () =>
        invoke<Array<{ id: number; nome_produto: string; unidade: string; estoque: number; min_estoque: number }>>('erp:stock:low'),
    },
    prices: {
      list: (args?: { search?: string; id_tipo?: number | null; onlyLowMargin?: boolean; limit?: number }) =>
        invoke<Array<{
          id: number;
          nome_produto: string;
          cod_barra: string | null;
          unidade: string | null;
          vr_compra: number | null;
          vr_venda: number | null;
          vr_venda_2: number | null;
          estoque: number | null;
          id_tipo: number | null;
          nome_tipo: string | null;
          vr_promocao_ativo: number | null;
          promocao_qty_min: number | null;
          promocao_data_fim: string | null;
        }>>('erp:prices:list', args ?? {}),
      bulkUpdate: (updates: Array<{ id: number; vr_venda?: number; vr_venda_2?: number; vr_compra?: number }>) =>
        invoke<{ ok: boolean; count: number }>('erp:prices:bulk-update', updates),
      applyMarkup: (args: { productIds: number[]; markupPercent: number; base: 'compra' | 'venda' }) =>
        invoke<{ ok: boolean; count: number }>('erp:prices:apply-markup', args),
    },
    promotions: {
      list: (args?: { status?: 'active' | 'scheduled' | 'expired' | 'all' }) =>
        invoke<Array<{
          id: number;
          id_produto: number;
          descricao: string | null;
          vr_promocao: number;
          quantidade_minima: number;
          data_inicio: string;
          data_fim: string | null;
          inativo: number;
          data_criacao: string;
          nome_produto: string | null;
          cod_barra: string | null;
          unidade: string | null;
          vr_venda_original: number | null;
        }>>('erp:promotions:list', args ?? {}),
      save: (data: {
        id?: number;
        id_produto: number;
        descricao?: string | null;
        vr_promocao: number;
        quantidade_minima?: number;
        data_inicio: string;
        data_fim?: string | null;
        inativo?: number;
      }) => invoke<{ id: number }>('erp:promotions:save', data),
      saveBulk: (args: {
        items: Array<{ id_produto: number; vr_promocao: number; quantidade_minima?: number }>;
        descricao?: string;
        data_inicio: string;
        data_fim?: string | null;
      }) => invoke<{ ok: boolean; count: number }>('erp:promotions:save-bulk', args),
      toggle: (id: number, inativo: boolean) => invoke<{ ok: boolean }>('erp:promotions:toggle', id, inativo),
      delete: (id: number) => invoke<{ ok: boolean }>('erp:promotions:delete', id),
    },
    nfe: {
      pickFile: () =>
        invoke<{ filePath: string; xml: string; parsed: NFeParsed } | null>('erp:nfe:pick-file'),
      parse: (xml: string) => invoke<NFeParsed>('erp:nfe:parse', xml),
      matchItems: (items: NFeItem[]) =>
        invoke<Array<{
          item: NFeItem;
          matchedProductId: number | null;
          matchedBy: 'barcode' | 'name' | null;
          matchedName?: string;
          matchedPrice?: number;
          matchedStock?: number;
        }>>('erp:nfe:match-items', items),
      import: (args: {
        parsed: NFeParsed;
        mappings: Array<{
          item: NFeItem;
          action: 'create' | 'update' | 'skip';
          productId?: number;
          suggestedPrice?: number;
        }>;
        supplierId: number | null;
        markupPercent?: number;
      }) => invoke<{ ok: boolean; created: number; updated: number; skipped: number; idFornecedor: number; numeroNota: string }>('erp:nfe:import', args),
    },
    finance: {
      accounts: () =>
        invoke<Array<{ id: number; conta_descricao: string; inf_adicional: string | null }>>('erp:finance:accounts'),
      saveAccount: (data: Record<string, unknown>) => invoke<{ id: number }>('erp:finance:save-account', data),
      plans: () =>
        invoke<Array<{ id: number; plane_cod: number; plane_descricao: string; plane_tipo: 'E' | 'S' }>>('erp:finance:plans'),
      launches: {
        list: (args?: { from?: string; to?: string; tipo?: 'E' | 'S' | 'all'; status?: 'pending' | 'paid' | 'all' }) =>
          invoke<Array<Record<string, unknown>>>('erp:finance:launches:list', args ?? {}),
        save: (data: Record<string, unknown>) => invoke<{ id: number }>('erp:finance:launches:save', data),
        markPaid: (args: { id: number; data_confirmacao: string; vr_pago: number; id_modo_lancamento?: number }) =>
          invoke<{ ok: boolean }>('erp:finance:launches:mark-paid', args),
      },
      summary: () =>
        invoke<{
          receivable: { total: number; qtd: number };
          payable: { total: number; qtd: number };
          overdue: { total: number; qtd: number };
        }>('erp:finance:summary'),
      paymentMethods: () =>
        invoke<Array<{ id: number; modo_lancamento: string }>>('erp:finance:payment-methods'),
    },
    dashboard: () =>
      invoke<{
        today: { total: number; pedidos: number };
        month: { total: number; pedidos: number };
        productCount: number;
        clientCount: number;
        dailyChart: Array<{ dia: string; total: number }>;
        topProducts: Array<{ nome_produto: string; total_qtd: number; total_valor: number }>;
      }>('erp:dashboard:stats'),
  },

  fiscal: {
    getSettings: () =>
      invoke<{
        enabled: boolean;
        provider: 'focusnfe' | 'none';
        ambiente: 'homologacao' | 'producao';
        uf: string;
        serie: number;
        proximo_numero: number;
        regime_tributario: 1 | 2 | 3;
        cnae: string;
        ncm_padrao: string;
        cfop_padrao: string;
        cst_csosn_padrao: string;
        origem_padrao: number;
        focusnfe_token: string;
        focusnfe_csc_id: string;
        focusnfe_csc_token: string;
      }>('fiscal:get-settings'),
    saveSettings: (s: {
      enabled: boolean;
      provider: 'focusnfe' | 'none';
      ambiente: 'homologacao' | 'producao';
      uf: string;
      serie: number;
      proximo_numero: number;
      regime_tributario: 1 | 2 | 3;
      cnae: string;
      ncm_padrao: string;
      cfop_padrao: string;
      cst_csosn_padrao: string;
      origem_padrao: number;
      focusnfe_token: string;
      focusnfe_csc_id: string;
      focusnfe_csc_token: string;
    }) => invoke<{ ok: boolean }>('fiscal:save-settings', s),
    emitNFCe: (idVenda: number) =>
      invoke<{
        ok: boolean;
        status: string;
        chave_nfe?: string;
        numero?: number;
        serie?: number;
        protocolo?: string;
        url_danfe?: string;
        qrcode_url?: string;
        mensagem?: string;
      }>('fiscal:emit-nfce', idVenda),
    pollNFCe: (ref: string) =>
      invoke<{
        ok: boolean;
        status: string;
        chave_nfe?: string;
        protocolo?: string;
        url_danfe?: string;
        qrcode_url?: string;
        mensagem?: string;
      }>('fiscal:poll-nfce', ref),
    cancelNFCe: (args: { ref: string; justificativa: string }) =>
      invoke<{ ok: boolean; status: string; mensagem?: string }>('fiscal:cancel-nfce', args),
    getByVenda: (idVenda: number) =>
      invoke<{
        id: number;
        status: string;
        chave_nfe: string | null;
        numero: number | null;
        serie: number | null;
        protocolo: string | null;
        url_danfe: string | null;
        qrcode_url: string | null;
        mensagem_sefaz: string | null;
        ref_externa: string;
      } | null>('fiscal:get-nfce-by-venda', idVenda),
    listPending: () =>
      invoke<Array<{
        id: number;
        id_venda: number;
        controle: string;
        data_venda: string;
        vr_total: number;
        status: string;
        chave_nfe: string | null;
        mensagem_sefaz: string | null;
        ref_externa: string;
      }>>('fiscal:list-pending'),
    retryPending: () =>
      invoke<{ processed: number; ok: number; failed: number }>('fiscal:retry-pending'),
    retryOne: (idVenda: number) =>
      invoke<{ ok: boolean; status: string; mensagem?: string; chave_nfe?: string }>('fiscal:retry-one', idVenda),
  },

  pdv: {
    listProducts: (args?: { search?: string; limit?: number; id_tipo?: number | null }) =>
      invoke<Array<{
        id: number;
        nome_produto: string;
        cod_barra: string | null;
        unidade: string | null;
        vr_venda: number | null;
        estoque: number | null;
        fracionado: number | null;
      }>>('pdv:list-products', args ?? {}),
    topSellers: (args?: { limit?: number; days?: number }) =>
      invoke<Array<{
        id: number;
        nome_produto: string;
        cod_barra: string | null;
        unidade: string | null;
        vr_venda: number | null;
        estoque: number | null;
        fracionado: number | null;
        total_vendido: number;
      }>>('pdv:top-sellers', args ?? {}),
    listCategories: () =>
      invoke<Array<{ id: number; nome_tipo: string; produtos: number }>>('pdv:list-categories'),
    listActivePromoTiers: () =>
      invoke<Array<{ id_produto: number; quantidade_minima: number; vr_promocao: number }>>('pdv:list-active-promo-tiers'),
    findByCode: (code: string) =>
      invoke<{
        id: number;
        nome_produto: string;
        cod_barra: string | null;
        unidade: string | null;
        vr_venda: number | null;
        estoque: number | null;
        fracionado: number | null;
      } | null>('pdv:find-product-by-code', code),
    listPaymentMethods: () =>
      invoke<Array<{ id: number; modo_lancamento: string; protegido: string | null }>>('pdv:list-payment-methods'),
    searchClients: (q: string) =>
      invoke<Array<{ id: number; nome_cliente: string; cpf_cnpj: string | null; telefone: string | null }>>('pdv:search-clients', q),
    getOpenCashier: () => invoke<{ id: number; data_abertura: string; hora_abertura: string; vr_abertura: number } | null>('pdv:get-open-cashier'),
    openCashier: (args: { vr_abertura: number; id_login: number; terminal?: string; turno?: string }) =>
      invoke<{ id: number }>('pdv:open-cashier', args),
    closeCashier: (args: { id: number; vr_fechamento: number }) =>
      invoke<{ ok: boolean }>('pdv:close-cashier', args),
    cashierSummary: (id: number) =>
      invoke<{
        caixa: {
          id: number;
          data_abertura: string;
          hora_abertura: string;
          vr_abertura: number;
          terminal: string;
        };
        stats: {
          pedidos: number;
          total: number;
          dinheiro: number;
          cheque: number;
          cartao: number;
          carne: number;
          ticket: number;
        };
        sangrias: number;
        suprimentos: number;
      } | null>('pdv:cashier-summary', id),
    cashMovement: (args: { id_caixa: number; tipo: 'S' | 'A'; valor: number; descricao?: string; id_login?: number }) =>
      invoke<{ ok: boolean; id: number }>('pdv:cash-movement', args),
    listCashMovements: (id_caixa: number) =>
      invoke<Array<{ id: number; tipo: 'S' | 'A'; valor: number; descricao: string | null; data_hora: string }>>('pdv:list-cash-movements', id_caixa),
    saveSale: (sale: {
      items: Array<{ id_produto: number; nome_produto: string; valor: number; quant: number; vr_total: number }>;
      payments: Array<{ cod_lancamento: number; valor: number }>;
      id_cliente?: number;
      vr_total: number;
      vr_desconto?: number;
      vr_troco?: number;
      observacao?: string;
      id_login?: number;
      terminal?: string;
      turno?: string;
    }) => invoke<{ ok: boolean; idVenda: number; control: string }>('pdv:save-sale', sale),
    dailySummary: () => invoke<{ pedidos: number; total: number }>('pdv:daily-summary'),
    getCompany: () =>
      invoke<{
        nome_empresa?: string;
        cpf_cpnj?: string;
        endereco?: string;
        bairro?: string;
        cidade?: string;
        uf?: string;
        telefone?: string;
      } | null>('pdv:get-company'),
    printReceipt: (
      data: {
        company: { nome_empresa?: string; cpf_cpnj?: string; endereco?: string; bairro?: string; cidade?: string; uf?: string; telefone?: string };
        control: string;
        operator?: string;
        items: Array<{ nome_produto: string; quant: number; valor: number; vr_total: number; unidade?: string }>;
        payments: Array<{ label: string; valor: number }>;
        subtotal: number;
        desconto: number;
        total: number;
        troco: number;
        cliente?: { nome?: string; cpf_cnpj?: string };
        nfce?: {
          chave_nfe: string;
          numero?: number | null;
          serie?: number | null;
          protocolo?: string | null;
          qrcode_url?: string | null;
          ambiente?: 'homologacao' | 'producao' | null;
        } | null;
      },
      openDrawerAfter?: boolean
    ) => invoke<{ ok: boolean; error?: string }>('printer:print-receipt', data, openDrawerAfter),
  },
};
