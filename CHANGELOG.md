# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e o projeto adota [Versionamento Semântico (SemVer)](https://semver.org/lang/pt-BR/):
`MAJOR.MINOR.PATCH` — incompatível / novidade compatível / correção.

## [Não lançado]

### Adicionado
- **Atualizações OTA (over-the-air)** via `electron-updater` + GitHub Releases.
  - `electron/services/updater.ts` centraliza o ciclo: check automático 10s
    após o boot, download em background sob demanda, aplicação na saída
    ou via botão. Estados são broadcast pelo canal IPC `updater:state`.
  - Novo componente `<UpdateBanner>` no canto inferior direito do AppShell
    e do PDV — mostra "nova versão disponível", barra de progresso do
    download e "reiniciar e aplicar" quando pronto.
  - **Configurações → Instalação e terminal** ganhou o card "Atualizações
    do sistema" com versão instalada e botão "Verificar" manual.
  - `build.publish` no package.json aponta para o repo `Usermoda/sistemapdv`.
  - Migrations idempotentes já existentes garantem que o schema evolua no
    boot sem intervenção. Config em `userData/` é preservada entre updates.
- **Documentação de release em [`docs/updates.md`](docs/updates.md)** — padrão
  SemVer, fluxo `npm version` + `git push --tags`, o que o cliente vê,
  comportamento em multi-terminal, rollback e assinatura de código.
- **Multi-terminal**: seletor "Servidor principal" / "Terminal adicional" no
  primeiro passo de banco de dados do wizard.
  - No modo **terminal**, o wizard só coleta host/porta/user/senha do servidor
    remoto, salva a config e pula automaticamente as etapas de Empresa,
    Pagamentos e Usuários (todos os dados vivem no servidor compartilhado).
  - No modo **servidor**, após o banco instalado, aparece um switch
    **"Compartilhar com outros terminais"** que:
    - Reinicia o MariaDB portable com `bind-address=0.0.0.0`
    - Executa `CREATE USER 'root'@'%'` + `GRANT ALL PRIVILEGES` + `FLUSH`
    - Lista os IPs LAN da máquina para o usuário informar aos terminais
    - Avisa sobre abrir a porta no Firewall do Windows
  - Nova config: `setup.mode` (`'server' | 'terminal'`) e `db.shareOnLan`.
  - Novos IPCs: `app:set-setup-mode`, `db:set-lan-sharing`, `db:get-lan-info`.
- Documentação completa em [`docs/multi-terminal.md`](docs/multi-terminal.md)
  com diagrama de rede, comandos de firewall, resolução de problemas e
  recomendações de segurança para redes locais.
- **Wizard: novas etapas "Pagamentos" e "Usuários"** entre Impressora e Concluir.
  - Pagamentos: ativa/desativa/cria formas de pagamento, com presets (PIX, cartões,
    voucher, fiado, cheque) em 1 clique. Formas protegidas (Dinheiro/Cartão) já vêm ativas.
  - Usuários: gera os perfis padrão (CAIXA/GERENTE/ESTOQUISTA/VENDEDOR) via um botão
    e permite criar usuários adicionais direto no setup.
- **Instalador NSIS com opções**:
  - Componente opcional "Iniciar Bipa com o Windows" — grava `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.
  - `createDesktopShortcut: "always"` — checkbox visível na tela de componentes do
    NSIS para o usuário desmarcar se não quiser atalho na área de trabalho.
  - `build/installer.nsh` — include custom com o Section do auto-start e a limpeza
    no uninstall.
- **Rebrand: Sistema PDV → Bipa.** Novo nome do produto, logo (combo mark: 4 barras
  de scan + "beep" ping em gradient azul→roxo) e wordmark aplicado no login,
  sidebar do ERP, wizard de setup e cabeçalho do cupom.
- **Componente `<BipaLogo>`** com variantes `mark` (só ícone), `word` (só wordmark)
  e `combo` (default). Reusável em toda a UI.
- **Geração de ícone**: script `scripts/generate-icons.ps1` (PowerShell + System.Drawing,
  sem dependências externas) que gera `build/icon.png` (256×256) e
  `build/icon.ico` (multi-frame 16/32/48/64/128/256) a partir do design canônico.
  Também escreve `public/bipa-icon.png` para uso web/favicon.
- **Janela sempre maximizada** no boot (`mainWindow.maximize()` antes do `show()`).
- **Auto-start com o Windows** — nova opção na etapa final do setup, com IPC
  `app:get-auto-start` / `app:set-auto-start` usando `app.setLoginItemSettings()`
  do Electron (grava no registry `HKCU\...\Run`).
- **Criar atalho no Menu Iniciar** — botão "Fixar na barra de tarefas" no setup;
  o app cria o `.lnk` via `shell.writeShortcutLink()` e instrui o usuário a
  fixar manualmente pelo botão direito (Windows 10/11 não permite pin
  programático).
- **AppUserModelId** setado (`app.setAppUserModelId('com.grupomaxcenter.sistemapdv')`)
  para o Windows agrupar corretamente na taskbar e mostrar o ícone/nome certos.
- Tela de **Login** redesenhada — imagem full-screen do PDV como fundo, card
  glassmorphism à direita com campos, toggle mostrar/ocultar senha e "Manter
  sessão iniciada" com persistência real de credenciais (auto-login em fresh
  start; após logout explícito, form aparece pré-preenchido esperando Enter).
- Script de empacotamento local `scripts/package.ps1` (`npm run package:win`), que aplica
  os ajustes de ambiente Windows (PATH, `ELECTRON_RUN_AS_NODE`, Modo Desenvolvedor,
  Smart App Control) antes de gerar o instalador.
- Documentação do processo de empacotamento e das pegadinhas de ambiente em
  [`docs/build-release.md`](docs/build-release.md).

### Corrigido
- `productName` no top-level do `package.json` mudava `app.getName()` e movia o
  `userData` do Electron para `%APPDATA%\Bipa\` — quebrando instalações existentes
  em `%APPDATA%\sistema-pdv\`. Agora fica só em `build.productName`, que só afeta
  o instalador/executável final.

## [0.1.0] - 2026-08-20

### Adicionado
- Primeira versão empacotável do Sistema PDV (Electron 33 + Vite + React + TypeScript).
- Pipeline de empacotamento via **electron-builder**: instalador **NSIS** (assistido,
  atalhos na área de trabalho/menu Iniciar, pt-BR) e distribuição **ZIP portátil**.
- **CI no GitHub Actions** (`.github/workflows/build-release.yml`): gera o instalador
  em runner Windows na nuvem e publica no **GitHub Releases** a cada tag `vX.Y.Z`.
- Documentação de build e release em [`docs/build-release.md`](docs/build-release.md).

### Corrigido
- **Setup do banco de dados:** o `testConnection` passou a detectar o suporte a InnoDB
  e, na instalação, se o servidor MySQL/MariaDB alvo estiver **sem InnoDB**
  (ex.: `skip-innodb`), o app faz **fallback automático para o MariaDB portable** —
  eliminando o erro `Unknown storage engine 'InnoDB'` em `erp:prices:list` e afins.

[Não lançado]: https://github.com/Usermoda/sistemapdv/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Usermoda/sistemapdv/releases/tag/v0.1.0
