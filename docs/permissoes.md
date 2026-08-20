# Permissões e usuários

Sistema de permissões por módulo baseado em perfis. Ver
`src/lib/permissions.ts` para as chaves canônicas.

## Chaves de permissão

| Chave | Módulo |
|---|---|
| `pdv` | Abrir e operar o caixa |
| `dashboard` | Visão geral e KPIs |
| `produtos` | CRUD de produtos e categorias |
| `precos` | Preços e promoções |
| `clientes` | Cadastro de clientes |
| `fornecedores` | Cadastro de fornecedores |
| `estoque` | Ajuste de estoque, NFe de entrada |
| `vendas` | Histórico de vendas |
| `financeiro` | Contas a pagar/receber |
| `relatorios` | Relatórios e exportação |
| `etiquetas` | Impressão de etiquetas |
| `config` | Configurações do sistema |

## Perfis pré-definidos

Ao criar um perfil, o admin pode partir de um template:

| Template | Permissões |
|---|---|
| **CAIXA** | Só `pdv`. Loga direto na tela de vendas. |
| **GERENTE** | Tudo exceto `config`. |
| **ESTOQUISTA** | `produtos`, `fornecedores`, `estoque`, `etiquetas`, `relatorios`. |
| **VENDEDOR** | `pdv`, `vendas`, `clientes`. |

Depois de escolhido o template, o admin pode marcar/desmarcar módulos
individualmente — a caixa **Selecionar tudo** e **Limpar** ajudam.

## Persistência

- Perfil: `cad_perfil.menu_options` — JSON `{ "pdv": true, "config": false, ... }`.
- Legado: string "SSSSSN..." (S = allow, N = deny). Se um perfil legado tem
  >= 50% de "S", `parsePermissions` o trata como admin (all-true).
- Usuário: `cad_login.senha` em bcrypt (10 rounds).

## Guards de rota

`src/auth/PermissionGuard.tsx` bloqueia rotas conforme permissão:

- Sem sessão → redireciona `/login`.
- Sem a permissão da rota:
  - Se o usuário só tem `pdv` → redireciona para `/pdv` (não vê o ERP).
  - Se tem outras permissões → redireciona para a primeira rota permitida.
  - Se não tem nada → mostra tela "Sem acesso" com botão de logout.

Sidebar do ERP filtra os itens do menu com base em `can(key)` do
`useAuth`.

## Fluxo de gerência

Em **Configurações → Usuários e perfis** (só admins):

1. Criar/editar perfis (ou usar template).
2. Criar/editar usuários (login, perfil, senha).
3. Trocar senha própria via **menu → Alterar senha**.

## Sessão

- Login: `POST` bcrypt-compare no `cad_login`.
- Sessão em memória (Zustand) — não persiste ao fechar o app.
- `useIdleTimeout` (só usuários "PDV-only") desloga automaticamente após
  N minutos ociosos (configurável).

## Login

Tela em `src/auth/LoginPage.tsx`. Se só existe 1 usuário admin (recém-criado
no setup), o login pré-seleciona ele.
