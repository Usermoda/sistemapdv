# Especificação funcional

Este documento resume **o que o sistema faz**, do ponto de vista de negócio.
Para "como é implementado" ver [arquitetura.md](arquitetura.md).

## Visão geral

Sistema PDV/ERP para pequenos e médios varejos. Roda offline (banco local),
com opção de emissão fiscal via API. Um único operador ou vários com perfis.

Público-alvo: mercearias, mini-mercados, adegas, casas de conveniência,
pet-shops.

## Escopo funcional

### 1. Instalação sem fricção

- **Setup wizard** guiado no primeiro boot.
- MariaDB portable baixado e instalado automaticamente.
- Cria banco + aplica schema + cria admin.
- Configura impressora e balança (opcional; pode fazer depois).
- Cadastra a empresa (fiscal).

**Critério de sucesso**: usuário sem conhecimento técnico consegue subir o
sistema em menos de 10 minutos.

### 2. Cadastro de produtos

- Nome, categoria, preço de compra/venda/atacado, estoque, estoque mínimo.
- **Códigos alternativos** (EAN adicional, código do fornecedor, código de
  balança) — evita duplicar cadastro quando o EAN muda ou fornecedores usam
  referências diferentes.
- **Vínculo com fornecedores** N:N.
- **Campos fiscais** (NCM, CFOP, CST/CSOSN, CEST, origem) — opcionais, com
  fallback para defaults.
- **Produto por peso** (fracionado) — integra com balança no PDV.
- Ativar/desativar sem apagar histórico.
- Cadastro rápido via PDV quando um EAN escaneado não existe.

### 3. PDV / caixa

- **Abertura de caixa** com valor inicial.
- **Adicionar item** por scanner, digitação de código, clique no card, ou
  categoria.
- **Multiplicador de quantidade** por teclado (digite qtd + Enter, depois o
  produto).
- **Editar item** — quantidade, preço unitário, observação.
- **Selecionar cliente** (CPF na nota).
- **Balança** — leitura direta do peso.
- **Sangria e suprimento** durante o caixa.
- **Finalizar venda** com múltiplas formas de pagamento.
- **Cupom** ESC/POS ou preview em iframe (browser dialog).
- **Últimas vendas** — reimpressão de cupom.
- **NFCe** (opcional) — emissão em paralelo à venda.
- **Fechamento de caixa** com resumo e diferença.

### 4. Preços e promoções

- **Edição em massa** dos preços com filtro por categoria e margem baixa.
- **Markup em N produtos** — reajusta pelo custo ou pelo preço atual.
- **Promoções por produto** com preço promocional específico.
- **Promoções por quantidade** ("leve 3, pague o preço de 2") —
  `quantidade_minima` por promoção. O PDV re-avalia automaticamente ao mudar
  a quantidade da linha.
- **Agenda** — promoções agendadas com `data_inicio` futura.
- **Pausar** sem apagar (`inativo`).

### 5. Etiquetas de gôndola

- Múltiplos formatos (A4 e bobina 80/90mm).
- Nome, embalagem, código de barras, preço grande.
- **Aplica promoção ativa** automaticamente (com "de/por" e tier).
- Preview inline e expandido antes de imprimir.
- Impressão via iframe (bypassa `window.open` bloqueado no Electron).

### 6. Estoque

- **Ajuste de estoque** com motivo (Ajuste+, Ajuste-, Inventário).
- **Histórico** por produto e por período.
- **Entrada por NF-e do fornecedor** — importa XML, casa produtos, atualiza
  preços e estoque.
- **Alerta de estoque baixo** — dashboard mostra produtos abaixo do mínimo.

### 7. Financeiro

- **Contas a pagar** e **a receber**.
- Registro automático de lançamentos por venda (uma linha por forma de
  pagamento).
- Marcar como pago (data, forma, observação).
- Categorias de lançamento.
- **Relatório de caixa** — entradas × saídas por período.

### 8. Vendas

- Lista com filtros por período, cliente, forma de pagamento.
- Detalhes com itens, pagamentos, cliente.
- Link para o DANFCE / XML quando NFCe autorizada.
- **Reimprimir cupom**.
- **Reemitir NFCe** para vendas com falha fiscal.

### 9. Relatórios

- Vendas por período, por categoria, por produto.
- Ticket médio, mix de produtos, top produtos.
- Formas de pagamento.
- Financeiro (fluxo de caixa).
- Exportação em **XLSX**.

### 10. Usuários e permissões

- Perfis pré-definidos: **CAIXA**, **GERENTE**, **ESTOQUISTA**, **VENDEDOR**.
- Permissões editáveis por módulo.
- Guards de rota redirecionam corretamente conforme permissão.
- Idle timeout para operadores de caixa.

### 11. Backup

- Backup on-demand (mysqldump).
- Backup agendado diário com retenção configurável.
- Restauração de arquivo.

## Fora de escopo

- Multi-loja (cada instância é uma loja).
- Sincronização em nuvem entre instâncias.
- E-commerce integrado.
- Certificado A1/A3 local (usa provedor SaaS Focus NFe para não precisar do
  certificado no equipamento).
- iOS / Android — desktop apenas.

## Fluxos críticos

### Venda com promoção por tier

1. Loja cria promoção "Cerveja Skol lata: 2,49 · a partir de 12 unidades".
2. Cliente escaneia 6 latas → preço = R$ 2,99 (base). Total: R$ 17,94.
3. Continua escaneando até 12 latas → linha re-precifica para R$ 2,49. Total: R$ 29,88.
4. Cliente retira 1 lata (11 unidades) → volta para R$ 2,99. Total: R$ 32,89.
5. Finaliza — NFCe usa o preço final por linha (R$ 2,99 em 11 unidades).

### Troca de EAN sem duplicar cadastro

1. Fornecedor muda o EAN do produto (comum quando muda de fabricante).
2. Estoquista abre o produto → aba **Códigos** → adicionar EAN novo.
3. PDV agora reconhece tanto o EAN antigo (estoque restante) quanto o novo.
4. Etiquetas usam o EAN "preferencial" (marcado com estrela).

### Emissão fiscal com erro

1. NFCe rejeitada por NCM inválido em um item.
2. Vendas → detalhes mostra a rejeição.
3. Estoquista corrige o NCM no cadastro do produto.
4. Volta em Vendas → **Reemitir** → nova NFCe autorizada.

### Setup em máquina offline

1. Baixar instalador do app + MariaDB portable numa máquina com internet.
2. Levar para a loja (pendrive).
3. Instalar; setup detecta MariaDB portable local e sobe sem baixar nada.
4. Configurar impressora, criar admin, começar a operar.

## Requisitos não-funcionais

- **Performance no PDV**: adicionar item ≤ 100ms (busca + re-price).
- **Confiabilidade**: vendas em transação ACID (`mv_vendas` + itens +
  pagamentos gravam junto ou nada).
- **Offline-first**: PDV opera 100% sem internet; NFCe fica em fila e emite
  quando reconectar.
- **Portabilidade**: Windows 10/11 primário; código evita path/OS-specific
  fora do instalador de MariaDB.
- **Idempotência**: migrações e IPC handlers usam `IF NOT EXISTS` para
  suportar re-execução (upgrade de versão sem perder dados).
