# Sistema PDV

PDV/ERP desktop moderno para varejo — venda no caixa, gestão de produtos,
promoções por quantidade, controle de estoque, financeiro, emissão de NFCe,
etiquetas de gôndola e relatórios.

Roda como aplicativo Electron em Windows, com MariaDB portable instalado
automaticamente na primeira execução. Interface pensada para touch screen e
teclado numérico, com integração para leitor de código de barras, balança
serial e impressora térmica ESC/POS.

## Stack

- **Electron 33** + **Vite** + **TypeScript** — desktop shell
- **React 18** + **Tailwind CSS** + **shadcn/ui** (Radix) — UI
- **Zustand** — state (carrinho, autenticação, prefs)
- **MariaDB portable** (auto-install) via **mysql2** — persistência
- **node-thermal-printer** — cupom ESC/POS + gaveta
- **serialport** — leitura da balança
- **fast-xml-parser** — importação de NF-e do fornecedor
- **jsbarcode** + **xlsx** — etiquetas e exportações
- **Focus NFe** (REST) — provedor NFCe

## Instalação (desenvolvedor)

```bash
npm install
npm run dev
```

O primeiro `npm run dev` abre o **Setup Wizard**:

1. Detecta ou instala MariaDB portable (baixa automaticamente se necessário).
2. Cria o banco `sistema_pdv` e aplica o schema inicial.
3. Cadastra a empresa (razão social, CNPJ, endereço fiscal).
4. Configura impressora térmica e gaveta (opcional).
5. Cria o primeiro usuário administrador.

Após concluído, o setup fica bloqueado por um `SetupGuard` — reabrir o app vai
direto para o Login.

### Requisitos

- Windows 10/11 (o instalador de MariaDB portable é específico para Windows;
  em macOS/Linux use um MariaDB/MySQL do sistema e aponte pela tela de setup)
- Node.js 20+
- (Opcional) Impressora térmica USB, leitor USB HID e balança serial

## Build

```bash
npm run typecheck
npm run build     # gera renderer + main + instalador (NSIS) + ZIP via electron-builder
```

Artefatos ficam em `release/`.

> ⚠️ O build local do instalador **falha em máquinas com Smart App Control (Windows 11)
> ligado**. O build oficial roda no **GitHub Actions** e publica no **GitHub Releases** a
> cada tag `vX.Y.Z`. Veja [docs/build-release.md](docs/build-release.md) para o passo a passo
> de release e [CHANGELOG.md](CHANGELOG.md) para o histórico de versões.

## Estrutura do projeto

```
electron/
  main.ts              # bootstrap do Electron
  preload.ts           # ponte segura para o renderer
  ipc/                 # handlers IPC por domínio (auth, pdv, erp, ...)
  services/            # camada de negócio (db, config, fiscal, hardware)
src/
  pdv/                 # tela de vendas (PDV)
  erp/                 # módulos administrativos (produtos, preços, ...)
  setup/               # wizard de primeira execução
  auth/                # login e guards de rota
  stores/              # Zustand (auth, pdv, prefs, theme)
  lib/                 # api bridge, permissions, utils
  components/          # UI reutilizáveis
db/schema.sql          # DDL inicial
scripts/               # geração do schema
docs/                  # documentação técnica (start aqui)
```

## Documentação

- [Especificação funcional](docs/spec.md) — o que o sistema faz (visão de negócio)
- [Arquitetura](docs/arquitetura.md) — como o Electron, o IPC e o banco se conversam
- [Banco de dados & migrações](docs/database.md) — tabelas principais e evolução do schema
- [PDV / caixa](docs/pdv.md) — fluxo de venda, atalhos, multiplicador, promoções
- [Preços e promoções](docs/precos-promocoes.md) — edição em massa e promoção por quantidade mínima
- [Etiquetas](docs/etiquetas.md) — formatos, bobina x A4, promoção na etiqueta
- [NFCe / fiscal](docs/nfce.md) — integração com Focus NFe
- [Hardware](docs/hardware.md) — impressora, gaveta, balança, leitor
- [Permissões e usuários](docs/permissoes.md) — perfis pré-definidos e customização
- [Configurações](docs/config.md) — chaves salvas em `userData/`
- [Build & Release](docs/build-release.md) — gerar o instalador e publicar versões

## Atalhos globais no PDV

| Tecla | Ação |
|---|---|
| **F2** | Focar campo de busca |
| **F4** | Finalizar venda |
| **F8** | Selecionar cliente / CPF na nota |
| **F9** | Abrir PDV (a partir do ERP) |
| **Dígitos + Enter** | Ativa multiplicador (ex.: 12 → Enter → próximo produto vem com qtd 12) |
| **Esc** | Cancelar multiplicador pendente |

## Licença

Uso interno / privado — sem licença pública.
