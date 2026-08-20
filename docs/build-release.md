# Build & Release

Como gerar o instalador do Sistema PDV e publicar uma versão.

## Visão geral

O empacotamento é feito com **electron-builder**, configurado no campo `build` do
[`package.json`](../package.json). São gerados dois artefatos para Windows x64:

| Artefato | Arquivo | Uso |
|---|---|---|
| Instalador NSIS | `Sistema PDV Setup X.Y.Z.exe` | Instalação assistida (atalhos, escolha de pasta) |
| ZIP portátil | `Sistema PDV-X.Y.Z-win.zip` | Extrair e rodar `Sistema PDV.exe` (sem instalar) |

O destino de saída é a pasta `release/` (ignorada pelo git).

> **Banco de dados:** o instalador **não** embute MySQL/MariaDB. Na primeira execução,
> o Setup Wizard instala o **MariaDB portable** automaticamente (e faz fallback para ele
> caso encontre um MySQL sem InnoDB). Nada precisa ser pré-instalado na máquina destino.

## Onde buildar

### ✅ Recomendado: CI no GitHub Actions

O build local **falha em máquinas com Smart App Control (WDAC) ligado**, porque o
electron-builder precisa executar um `.exe` não assinado ao montar o instalador NSIS,
e o Windows bloqueia (`spawn UNKNOWN` → *"An Application Control policy has blocked this file"*).

Por isso o build oficial roda na nuvem, em runner `windows-latest` (sem Smart App Control),
via [`.github/workflows/build-release.yml`](../.github/workflows/build-release.yml).

### Build local (opcional)

Só funciona se o Smart App Control estiver **desligado** e o Node 20+ instalado.

**Forma recomendada — script que já aplica os ajustes de ambiente:**

```powershell
npm run package:win            # instalador NSIS + ZIP em release/
# variações:
powershell -File scripts/package.ps1 -Install    # roda 'npm ci' antes
powershell -File scripts/package.ps1 -ZipOnly     # só o ZIP (não faz o passo NSIS)
```

O [`scripts/package.ps1`](../scripts/package.ps1) corrige o PATH, remove
`ELECTRON_RUN_AS_NODE`, avisa se o Modo Desenvolvedor está off ou o Smart App
Control está on, builda e lista os artefatos. Veja as *Notas de ambiente* abaixo.

**Forma manual:**

```bash
npm ci
npm run build        # instalador NSIS + ZIP em release/
# ou, para testar sem instalador:
npm run dist:dir     # apenas a pasta desempacotada (release/win-unpacked)
```

## Publicando uma nova versão (release)

O versionamento segue **SemVer** e o histórico fica em [`CHANGELOG.md`](../CHANGELOG.md).
O release é **disparado por tag**: ao empurrar uma tag `vX.Y.Z`, o CI builda e publica
o instalador no **GitHub Releases**.

Passo a passo:

1. **Atualize a versão** no `package.json` (campo `version`). Escolha o incremento:
   - `PATCH` (0.1.0 → 0.1.1): correções de bug.
   - `MINOR` (0.1.0 → 0.2.0): novas funcionalidades compatíveis.
   - `MAJOR` (0.1.0 → 1.0.0): mudanças incompatíveis.

   ```bash
   npm version patch   # ou: minor | major
   ```
   > `npm version` já atualiza o `package.json`, cria o commit e a tag `vX.Y.Z`.
   > Se preferir fazer manualmente, edite a versão, faça commit e crie a tag com o mesmo número.

2. **Atualize o `CHANGELOG.md`**: mova os itens de *Não lançado* para a nova versão, com a data.

3. **Empurre commit e tag:**
   ```bash
   git push origin main --follow-tags
   ```

4. **Acompanhe o build** em *Actions* no GitHub. Ao terminar, o instalador aparece em
   *Releases* (e também como artefato do workflow, por 30 dias).

Também é possível disparar o workflow manualmente (*Actions → Build & Release → Run workflow*)
para validar o build sem criar um release.

## Notas de ambiente e problemas encontrados (Windows)

Registro dos obstáculos enfrentados ao montar o primeiro empacotamento e como
foram resolvidos — o [`scripts/package.ps1`](../scripts/package.ps1) já trata
os itens 1 a 4 automaticamente.

1. **`npm` não reconhecido.** O Node.js foi instalado (`winget install OpenJS.NodeJS.LTS`),
   mas terminais abertos *antes* da instalação não enxergam o novo PATH.
   → Reabrir o terminal, ou recarregar o PATH da sessão (o script faz isso).

2. **App trava ao abrir no dev (`Cannot read properties of undefined (reading 'whenReady')`).**
   Causa: a variável de ambiente **`ELECTRON_RUN_AS_NODE=1`** estava herdada no processo,
   fazendo o binário do Electron rodar como Node puro.
   → Remover a variável antes de `npm run dev`/build (o script faz isso).

3. **Build falha ao extrair o `winCodeSign` (`Cannot create symbolic link: A required privilege is not held`).**
   O pacote de ferramentas do electron-builder contém symlinks (dylibs de macOS);
   criá-los no Windows exige privilégio.
   → Ativar o **Modo Desenvolvedor** (Configurações → Sistema → Para desenvolvedores),
   que permite criar symlinks sem elevação.

4. **Build do NSIS falha com `spawn UNKNOWN` / *"An Application Control policy has blocked this file"*.**
   Causa: o **Smart App Control (WDAC)** do Windows 11 bloqueia a execução do instalador
   temporário **não assinado** que o electron-builder precisa rodar para gerar o desinstalador.
   → Opções: (a) gerar pelo **GitHub Actions** (runner sem Smart App Control — recomendado);
   (b) rodar `-ZipOnly` (não executa o stub); ou (c) **desligar o Smart App Control**
   (⚠️ irreversível — só religa reinstalando o Windows), feito pela Segurança do Windows
   → Controle de aplicativos e navegador.

5. **Fix de banco relacionado ao empacotamento.** Em máquinas com um MySQL/MariaDB
   existente sem InnoDB, o setup passou a fazer *fallback* automático para o MariaDB
   portable — ver [`CHANGELOG.md`](../CHANGELOG.md) (0.1.0).

## Assinatura digital (futuro)

Os artefatos saem **sem assinatura**. Em máquinas com SmartScreen/Smart App Control, o
usuário verá um aviso ("aplicativo não reconhecido") — basta *Mais informações → Executar
assim mesmo*. Para eliminar o aviso, adquira um certificado de *code signing* (OV ou EV) e
configure as variáveis `CSC_LINK` (o `.pfx` em base64) e `CSC_KEY_PASSWORD` como *secrets*
do repositório; o electron-builder assina automaticamente no CI.

## Ícone do aplicativo (futuro)

Atualmente é usado o ícone padrão do Electron. Para personalizar, adicione
`build/icon.ico` (256×256) — o electron-builder o utiliza automaticamente.
