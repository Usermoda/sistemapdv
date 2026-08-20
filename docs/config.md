# Configurações

Configurações do aplicativo ficam em `userData/config.json`. O caminho
depende do OS (via `app.getPath('userData')`):

- **Windows**: `%APPDATA%\sistema-pdv\config.json`
- **macOS**: `~/Library/Application Support/sistema-pdv/config.json`
- **Linux**: `~/.config/sistema-pdv/config.json`

Não versionado no repositório. Contém credenciais — **nunca commitar**.

## Schema (`electron/services/config.ts`)

```ts
type ConfigSchema = {
  'database.host'?: string;
  'database.port'?: number;
  'database.user'?: string;
  'database.password'?: string;
  'database.database'?: string;

  'printer.configured'?: boolean;
  'printer.type'?: 'usb' | 'network' | 'serial';
  'printer.interface'?: string;
  'printer.name'?: string;
  'printer.width'?: 32 | 48;
  'printer.drawerEnabled'?: boolean;
  'printer.drawerCode'?: number;
  'printer.autoPreview'?: 'always' | 'when-no-printer' | 'never';

  'scale.enabled'?: boolean;
  'scale.port'?: string;
  'scale.baudRate'?: number;
  'scale.protocol'?: 'toledo' | 'filizola' | 'urano' | 'generic';

  'fiscal.enabled'?: boolean;
  'fiscal.provider'?: 'focusnfe';
  'fiscal.environment'?: 'homologacao' | 'producao';
  'fiscal.token'?: string;
  'fiscal.default.ncm'?: string;
  'fiscal.default.cfop'?: string;
  'fiscal.default.cstCsosn'?: string;
  'fiscal.default.cest'?: string;
  'fiscal.default.origemProduto'?: number;

  'company.razaoSocial'?: string;
  'company.cnpj'?: string;
  'company.ie'?: string;
  'company.endereco'?: { ... };

  'backup.enabled'?: boolean;
  'backup.time'?: string;    // HH:MM
  'backup.retentionDays'?: number;

  'pdv.idleTimeoutMin'?: number;
  'pdv.showSuccessScreen'?: boolean;
  'pdv.successScreenSeconds'?: number;

  'setup.completed'?: boolean;
};
```

## Como o app lê

`getConfig()` retorna um `JsonStore` singleton com `get(key)` / `set(key, value)`.
Cada `set` grava o JSON no disco.

Não use `electron-store` — implementação custom simples (foi trocada porque
`electron-store` v8+ é ESM e não convive bem com o build CJS do main).

## Setup

`setup.completed = true` é gravado ao final do wizard. `SetupGuard` bloqueia
todas as rotas até isso acontecer, redirecionando para `/setup`.

Se precisar re-rodar o setup manualmente, delete a chave `setup.completed`
do config e reinicie o app. Ou, mais nuclear, apague o `config.json` (isso
apaga credenciais também, tenha certeza).

## Backup automático

Se `backup.enabled` está ligado, um timer no main dispara `mysqldump` no
horário definido (`backup.time`, formato `HH:MM`). Arquivos ficam em
`userData/backups/` com timestamp no nome.

`backup.retentionDays` limita a retenção — arquivos mais antigos são
deletados após o backup diário rodar.

## Migração de config

Não há sistema de migração de config (por enquanto). Se um esquema mudar em
versões futuras, os defaults gracefully caem para os valores atuais e o
usuário refaz o passo relevante.
