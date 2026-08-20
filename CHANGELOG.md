# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e o projeto adota [Versionamento Semântico (SemVer)](https://semver.org/lang/pt-BR/):
`MAJOR.MINOR.PATCH` — incompatível / novidade compatível / correção.

## [Não lançado]

### Adicionado
- Script de empacotamento local `scripts/package.ps1` (`npm run package:win`), que aplica
  os ajustes de ambiente Windows (PATH, `ELECTRON_RUN_AS_NODE`, Modo Desenvolvedor,
  Smart App Control) antes de gerar o instalador.
- Documentação do processo de empacotamento e das pegadinhas de ambiente em
  [`docs/build-release.md`](docs/build-release.md).

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
