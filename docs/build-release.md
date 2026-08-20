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

Só funciona se o Smart App Control estiver **desligado** e o Node 20+ instalado:

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

## Assinatura digital (futuro)

Os artefatos saem **sem assinatura**. Em máquinas com SmartScreen/Smart App Control, o
usuário verá um aviso ("aplicativo não reconhecido") — basta *Mais informações → Executar
assim mesmo*. Para eliminar o aviso, adquira um certificado de *code signing* (OV ou EV) e
configure as variáveis `CSC_LINK` (o `.pfx` em base64) e `CSC_KEY_PASSWORD` como *secrets*
do repositório; o electron-builder assina automaticamente no CI.

## Ícone do aplicativo (futuro)

Atualmente é usado o ícone padrão do Electron. Para personalizar, adicione
`build/icon.ico` (256×256) — o electron-builder o utiliza automaticamente.
