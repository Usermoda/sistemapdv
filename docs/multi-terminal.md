# Multi-terminal (Servidor + Terminais na LAN)

Como configurar o Bipa em **múltiplas máquinas** compartilhando o mesmo banco
de dados. Uma máquina hospeda o banco (servidor principal) e as demais são
terminais adicionais que só rodam a interface do PDV.

## Visão geral

```
                    ┌──────────────────┐
                    │  Servidor Bipa   │  (com MariaDB portable)
                    │  192.168.0.10    │
                    └────────┬─────────┘
                             │  MySQL na porta 3307 (LAN)
       ┌─────────────────────┼─────────────────────┐
       │                     │                     │
┌──────┴──────┐       ┌──────┴──────┐       ┌──────┴──────┐
│ Terminal 1  │       │ Terminal 2  │       │ Terminal 3  │
│ 192.168.0.20│       │ 192.168.0.21│       │ 192.168.0.22│
│ (só Bipa)   │       │ (só Bipa)   │       │ (só Bipa)   │
└─────────────┘       └─────────────┘       └─────────────┘
```

Todos os terminais operam no mesmo banco, então:
- Vendas de qualquer caixa aparecem no ERP em tempo real
- Estoque é único e compartilhado
- Cada venda registra quem foi o operador (`id_login` em `mv_vendas`)
- Relatórios filtram por operador, por terminal ou consolidado

## Passo 1 — Instalar o **servidor principal**

Na máquina que vai hospedar o banco:

1. Rodar `Bipa Setup 0.1.0.exe`.
2. No wizard, ao chegar em **Banco de dados**, deixar selecionado
   **"Servidor principal"** (opção padrão).
3. Continuar o fluxo normal — o instalador baixa e configura o MariaDB
   portable, cria o banco, aplica o schema.
4. Ainda na etapa Banco de dados, após aparecer "Estrutura instalada",
   ativar o switch **"Compartilhar com outros terminais"**.
5. O sistema mostra os **endereços IP LAN** desta máquina (ex.:
   `192.168.0.10:3307`). Anote — os terminais vão precisar disso.

### Liberar a porta no Firewall do Windows

O próprio Bipa faz isso por você. Clique no botão **"Liberar porta N no Firewall"**
que aparece embaixo da lista de IPs (tanto no wizard quanto em
**Configurações → Instalação e terminal**). O Windows vai pedir aprovação de
administrador (UAC) — aprove uma vez e a regra fica gravada.

Se preferir fazer manualmente pelo PowerShell:

```powershell
netsh advfirewall firewall add rule name="Bipa MariaDB" `
  dir=in action=allow protocol=TCP localport=3307
```

(Ajuste `3307` para a porta que o Bipa mostrou.)

Para remover a regra depois — o Bipa tem o botão **"Remover regra"** ao lado,
ou via PowerShell:

```powershell
netsh advfirewall firewall delete rule name="Bipa MariaDB"
```

## Passo 2 — Instalar cada **terminal adicional**

Nas outras máquinas:

1. Rodar `Bipa Setup 0.1.0.exe` normalmente.
2. No wizard → **Banco de dados** → clicar em **"Terminal adicional"**.
3. Preencher:
   - **Host**: o IP do servidor (ex.: `192.168.0.10`)
   - **Porta**: a mesma do servidor (padrão: `3307`)
   - **Usuário**: `root`
   - **Senha**: vazia (padrão do MariaDB portable)
4. Clicar em **Testar conexão** — deve mostrar "Conectado".
5. Clicar em **Conectar**. O terminal salva as credenciais e não instala
   nenhum banco local — usa o remoto.
6. O wizard pula automaticamente as etapas de **Empresa**, **Pagamentos** e
   **Usuários** (já existem no servidor). Você só configura a impressora local
   e conclui.
7. Faça login no terminal com um dos usuários cadastrados no servidor
   (ex.: um perfil CAIXA para o operador).

## Passo 3 — Identificar cada terminal

Cada máquina tem um **terminal ID** (padrão `01`). Configure valores diferentes
em cada máquina (`02`, `03`, ...) para que as vendas fiquem separadas por
terminal. Localização: **Configurações → Terminal** (após o setup).

## Vendas por operador

Cada venda grava `mv_vendas.id_login` — o usuário que estava logado no PDV.
No ERP:

- **Relatórios → Vendas por período** — filtro por operador
- **Vendas → lista** — coluna "Operador" ao lado da forma de pagamento
- **Configurações → Usuários** — resumo de vendas do dia por login

## Solução de problemas

### "Falha ao conectar" no terminal

- Confirme que o servidor está ligado e o Bipa está aberto lá.
- Do terminal, teste com `Test-NetConnection 192.168.0.10 -Port 3307` no
  PowerShell — deve retornar `TcpTestSucceeded: True`.
- Se falha, o firewall da máquina servidor está bloqueando. Volte ao Passo 1.

### "Access denied for user 'root'@'192.168.x.x'"

- No servidor, o switch de compartilhamento faz o GRANT, mas se algo deu errado,
  execute manualmente (no MySQL client do servidor):
  ```sql
  CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY '';
  GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
  FLUSH PRIVILEGES;
  ```

### O servidor troca de IP na LAN

O MariaDB do Bipa escuta em `0.0.0.0`, então funciona com qualquer IP local.
O problema é apenas os terminais que memorizaram o IP antigo. Duas opções:

1. **DHCP com reserva** no seu roteador — vincule o MAC do servidor a um IP
   fixo. É o mais robusto.
2. **Nome NetBIOS**: no terminal, use o hostname do servidor em vez do IP
   (ex.: `Host: PC-CAIXA-01`). Windows resolve automaticamente na LAN.

### "Backup" e "Restaurar" no modo terminal

Backups são feitos **apenas no servidor** — os terminais compartilham o
mesmo banco, então não há dados locais para salvar. A tela **Configurações →
Backup** fica oculta nos terminais.

## Segurança (opcional, para lojas maiores)

O setup default usa `root` com senha vazia, o que é aceitável para redes
locais isoladas. Para endurecer:

1. Definir senha do root:
   ```sql
   ALTER USER 'root'@'localhost' IDENTIFIED BY 'senha_forte';
   ALTER USER 'root'@'%' IDENTIFIED BY 'senha_forte';
   FLUSH PRIVILEGES;
   ```
2. Atualizar a senha em **Configurações → Banco de dados** em todas as máquinas.
3. **Nunca exponha a porta 3307 à internet** — só use na LAN. Não faça
   port-forwarding no roteador.
