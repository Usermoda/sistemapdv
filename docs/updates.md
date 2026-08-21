# Atualizações OTA (over-the-air)

O Bipa recebe atualizações automaticamente pelo GitHub Releases. Nenhum
cliente precisa reinstalar quando você publica uma correção ou uma feature —
o app baixa em background e aplica na próxima reinicialização.

## Padrão de versionamento

Usamos **SemVer**: `MAJOR.MINOR.PATCH`.

| Tipo | Quando incrementar | Exemplo |
|---|---|---|
| **PATCH** | Bugfix, correção sem mudança de comportamento | `0.1.1 → 0.1.2` |
| **MINOR** | Nova feature retro-compatível (não quebra nada) | `0.1.5 → 0.2.0` |
| **PATCH em MINOR** | Bugfix em cima da feature nova | `0.2.0 → 0.2.1` |
| **MAJOR** | Mudança que quebra compatibilidade (raro) | `0.9.3 → 1.0.0` |

**Regra prática**: se você tocou em código do app e quer que os clientes
recebam a mudança, **bump a versão**. Cada mudança relevante = uma versão.

## Fluxo de release (por commit / grupo de commits)

```bash
# 1. Trabalhe normalmente e commite pro main
git add -A
git commit -m "feat: nova aba de relatórios"
git push

# 2. Quando quiser publicar, incremente a versão
npm version patch    # 0.1.1 → 0.1.2  (bugfix)
# OU
npm version minor    # 0.1.5 → 0.2.0  (feature)
# OU
npm version major    # 0.9.3 → 1.0.0  (breaking)

# `npm version` já cria a tag `v0.1.2` e faz commit "0.1.2".

# 3. Empurre o commit + tag
git push
git push --tags

# 4. O CI (.github/workflows/build-release.yml) detecta a tag `vX.Y.Z`,
#    builda em runner Windows na nuvem e publica no GitHub Releases
#    o Bipa Setup X.Y.Z.exe + Bipa-X.Y.Z-win.zip + latest.yml + .blockmap.
```

Pronto. Em até ~15min todos os Bipas em produção recebem a notificação.

## O que o cliente vê

1. Abre o Bipa como sempre.
2. **10 segundos após o boot**, o app pergunta pro GitHub qual é a última
   versão publicada. Se for maior que a instalada, aparece um banner no canto
   inferior direito:
   > **Nova versão disponível — v0.2.0**
   > Baixar agora em segundo plano? Você continua trabalhando normalmente.
   > [ Baixar ]   [ Mais tarde ]
3. Ao clicar em **Baixar**, o app baixa em background usando **deltas**
   (blockmap) — só os pedaços que mudaram, tipicamente 5–15 MB.
4. Quando termina, o banner muda para:
   > **Atualização v0.2.0 pronta!**
   > O Bipa vai fechar e reabrir para aplicar.
   > [ Reiniciar e aplicar ]   [ Mais tarde ]
5. Se clicar em "Mais tarde", a atualização aplica automaticamente **na
   próxima vez que o cliente fechar o Bipa**.

Nada é forçado no meio do uso — importante em ambiente de caixa.

## O que **não** muda com o update

- **`userData/config.json`** — credenciais do banco, impressora, empresa,
  preferências. Preservados intactos.
- **Banco de dados** — MariaDB portable e todos os dados dele ficam na sua
  pasta. As **migrations** (idempotentes, aditivas) rodam no boot pra evoluir
  o schema quando necessário.
- **Backups** em `userData/backups/`.

Ou seja: update apenas troca os arquivos do executável. Zero risco de perder
dados.

## Verificação manual

**Configurações → Instalação e terminal → seção "Atualizações do sistema"**
tem um botão **"Verificar"** que consulta o servidor imediatamente, sem
esperar o check automático.

## Multi-terminal — quem atualiza quando?

Cada máquina atualiza **independente**. Todas apontam pro mesmo
`latest.yml` do GitHub. O boot check é escalonado naturalmente (cada máquina
abre em horário ligeiramente diferente), então não há tempestade de download.

**Risco a considerar**: um servidor pode atualizar antes dos terminais, e a
nova versão pode introduzir uma migration no banco. Se um terminal antigo
tentar operar sobre o schema já migrado, geralmente funciona — as migrations
são **aditivas** (só criam colunas/tabelas novas, nunca removem). Ainda
assim, para minor bumps que mexem em schema, é boa prática:

1. Atualizar o servidor primeiro (sem tráfego, fim do expediente).
2. Confirmar que voltou pro ar.
3. Deixar os terminais atualizarem no próprio ritmo.

## Rollback

O `electron-updater` **não** faz rollback automático. Se a versão nova quebra:

- **Preferido**: publicar `X.Y.Z+1` corrigindo o bug. Os clientes recebem em
  minutos.
- **Emergencial**: instalar manualmente uma versão antiga baixada do
  GitHub Releases. Como `allowDowngrade = false` no updater, isso não é
  aplicado automaticamente — precisa rodar o `.exe` antigo à mão.

Por isso a regra: **teste bem** antes de tagar. Rode `npm run dist:dir` e abra
o `.exe` de `release/win-unpacked/` para uma prova local antes de `git push
--tags`.

## Publicando a primeira release (v0.1.0)

O código já foi buildado localmente várias vezes. Para publicar oficialmente
como release do GitHub (o que ativa o updater dos clientes):

```bash
# Ainda estamos em 0.1.0 no package.json — publica ela como primeira release
git tag v0.1.0
git push --tags
```

O workflow builda e publica os artefatos automaticamente. Dali em diante,
qualquer `npm version` seguido de `git push --tags` empurra uma nova
release.

## Assinatura de código (opcional)

O Bipa é publicado **sem assinatura digital**. Consequências:

- Na **primeira instalação**, o Windows mostra "SmartScreen: aplicativo não
  reconhecido" — o cliente clica em "Mais informações → Executar assim mesmo".
- Nos **updates** aplicados via `electron-updater`, o mesmo pop-up pode
  aparecer ocasionalmente (varia por reputação acumulada).

Para eliminar isso, assine com um certificado de Code Signing (OV custa
~R$ 700–1000/ano; certificado EV é 3–5× mais caro mas remove o warning
imediatamente). Configuração ficaria em `build.win.certificateFile` +
`certificatePassword` (nunca no repo — usar secrets do GitHub Actions).

Não é bloqueante para o funcionamento — só cosmético.
