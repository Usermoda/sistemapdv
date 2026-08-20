# Arquitetura

Aplicação Electron dividida em três camadas: **main** (processo Node), **preload**
(ponte segura) e **renderer** (React/Vite). Comunicação exclusivamente por IPC
tipado — o renderer nunca fala direto com o banco nem com a impressora.

```
┌────────────────────────────┐
│  Renderer (React + Vite)   │
│  src/                       │
│                             │
│  window.api.invoke(...) ────┼──┐
└────────────────────────────┘  │
                                │  IPC
┌────────────────────────────┐  │
│  Preload (electron/preload)│  │  (contextBridge)
│  Whitelisted channels      │◀─┘
└────────────────────────────┘
                                ▲
┌────────────────────────────┐  │
│  Main (electron/main.ts)   │  │
│                             │  │
│  ipc/  ← handlers          ├──┘
│  services/ ← DB, fiscal,   │
│              hardware      │
└────────────────────────────┘
        │           │            │
        ▼           ▼            ▼
   MariaDB     Focus NFe    Impressora
   (local)     (REST)       / balança
                             (USB/COM)
```

## Camadas

### Renderer (`src/`)

Vite dev server em modo dev, bundle estático em produção. Não tem acesso direto
a Node — usa apenas `window.api` exposto pelo preload. Todo o estado local do
carrinho, tema e sessão vive em stores Zustand.

- Router: `react-router-dom` com **HashRouter** (compatível com carregamento de arquivo local em produção)
- Guards: `SetupGuard` (bloqueia app até setup terminar), `AuthGuard` (exige login), `PermissionGuard` (por rota)
- UI base: Radix + Tailwind + shadcn/ui, componentes em `src/components/ui/`

### Preload (`electron/preload.ts`)

Expõe apenas duas funções ao renderer via `contextBridge`:

- `window.api.invoke(channel, ...args)` — chama um handler IPC
- `window.api.on(channel, cb)` — assina eventos push (usado por progresso do setup)

Nenhum objeto Node é passado direto — o renderer roda com `contextIsolation: true`
e `nodeIntegration: false`.

### Main (`electron/`)

- `main.ts` — cria a janela, registra os handlers IPC no boot, dispara migrações
- `ipc/*.ts` — um arquivo por domínio (`auth`, `pdv`, `erp`, `fiscal`, `hardware`, `printer`, `backup`, `reports`, `setup`, `db`). Cada handler é um `ipcMain.handle('canal:ação', ...)`.
- `services/*.ts` — código de negócio reusável (conexão com pool MySQL, emissor NFCe, driver da balança, gerador de cupom, migrations idempotentes, instalador de MariaDB portable).

## API bridge (`src/lib/api.ts`)

Um único objeto `api` agrupa todas as chamadas IPC tipadas em TypeScript. Cada
método é um `invoke<T>(...)`. Exemplo:

```ts
const p = await api.pdv.findByCode('789...');
await api.erp.products.saveCode({ id_produto: 12, tipo: 'BALANCA', codigo: '234' });
```

Isso mantém o renderer completamente ignorante dos canais IPC — se um canal
mudar, só o `api.ts` precisa ser atualizado.

## State (Zustand)

| Store | Responsabilidade |
|---|---|
| `usePdv` | Carrinho, pagamentos, cliente ativo, caixa aberto, tiers de promoção em cache, funções de repricing |
| `useAuth` | Sessão atual (login, perfil, permissões), `can(key)` |
| `usePrefs` | Preferências do renderer (interface, mensagens do PDV) |
| `useTheme` | Modo claro/escuro |

O `usePdv` reage a mudanças de quantidade recalculando o preço do item contra
os tiers de promoção carregados na abertura do caixa — sem round-trip por
alteração.

## Persistência

- **MariaDB** — dados transacionais (produtos, clientes, vendas, promoções, etc.)
- **`userData/config.json`** — configurações do app (conexão do banco, impressora, balança, credenciais fiscais). Não é versionado.
- **`userData/backups/`** — backups automáticos em `.sql`.

Ver [database.md](database.md) para o schema.

## Fluxo de dados de uma venda

1. Usuário digita ou escaneia um código → renderer chama `api.pdv.findByCode()`.
2. Main faz `SELECT` em `cad_produtos` (e fallback em `cad_produtos_codigos` para EAN alternativo / código de balança).
3. Renderer adiciona ao carrinho via `usePdv.addItem()` — a função re-avalia tiers de promoção.
4. Ao finalizar, renderer chama `api.pdv.saveSale({ items, payments, ... })`.
5. Main salva em `mv_vendas`/`mv_vendas_movimento`/`mv_lancamentos` numa **transação**.
6. Se a impressora estiver configurada, o main gera o cupom ESC/POS e imprime.
7. Se a NFCe estiver habilitada, o main dispara a emissão via Focus NFe (assíncrono).

## Build / distribuição

- `vite-plugin-electron/simple` compila o main em CJS (`dist-electron/main.cjs`).
- `electron-builder` empacota tudo em um instalador NSIS. O MariaDB portable é
  baixado sob demanda pelo instalador de banco (`electron/services/mysqlInstaller.ts`)
  para não engordar o instalador do app.
