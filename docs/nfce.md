# NFCe / Fiscal

Emissão de Nota Fiscal de Consumidor Eletrônica via **Focus NFe** (REST). O
código fica em `electron/services/fiscal/`.

## Como habilitar

Em **Configurações → Emissão fiscal**:

1. Marcar "Emitir NFCe".
2. Selecionar ambiente: **Homologação** (testes) ou **Produção**.
3. Colar o **token** do Focus NFe do CNPJ.
4. Definir defaults fiscais aplicados quando o produto não tem:
   - NCM padrão
   - CFOP padrão
   - CST/CSOSN padrão
   - CEST (opcional)
   - Origem da mercadoria

Estes campos podem ser sobrescritos por produto na aba **Fiscal** do form de
produto.

## Fluxo de emissão

1. Ao finalizar uma venda, o handler `pdv:save-sale` grava a venda e, se
   NFCe está habilitada, chama `emitirNFCe(sale)`.
2. `services/fiscal/emitter.ts` monta o payload:
   - Emitente (CNPJ, IE, endereço) — vem de `setup:get-company`.
   - Destinatário (se cliente selecionado com CPF/CNPJ na venda).
   - Itens (com fallback para os defaults fiscais).
   - Pagamentos (mapeados de `cad_modo_lancamento` → códigos SEFAZ).
3. `services/fiscal/focusnfe.ts` faz o POST autenticado.
4. Resposta é gravada em `nfce_emitidas` com status (autorizada, rejeitada,
   processando).
5. Se autorizada, o cupom impresso inclui o **QR Code** e a chave da NFCe.

## Consulta de status

Notas ficam com `status = 'processando'` até que a SEFAZ retorne a
autorização. Um job de polling (implementado no boot do app) consulta as
pendentes e atualiza o registro.

Na tela **Vendas → detalhes**, cada venda mostra o link para o DANFCE e
XML quando disponível.

## Contingência

Se a emissão falha (SEFAZ fora, sem internet), a venda **não é cancelada** —
ela fica salva localmente. O status da NFCe fica `rejeitada` ou `erro` e a
tela de Vendas destaca a nota para reemissão manual.

Fluxo de reemissão: **Vendas → detalhes → botão Reemitir**. Isso tenta gerar
uma nova NFCe (com nova referência externa) — a rejeitada é preservada como
histórico.

## Configuração de itens

A NFCe exige NCM válido e CFOP para cada item. Estratégia:

1. Se o produto tem `ncm` / `cfop` etc., usa esses valores.
2. Senão, cai para os defaults de Configurações.
3. Se nem produto nem default têm, a emissão falha com mensagem "NCM não
   configurado para produto X" — o operador pode preencher no cadastro do
   produto e reemitir.

## Impressão do cupom

Depois de autorizada, o cupom ESC/POS é impresso via `node-thermal-printer`
(ver [hardware.md](hardware.md)). Inclui:

- Cabeçalho da empresa
- Linhas dos itens (nome, qtd × unit, total)
- Total, formas de pagamento, troco
- Bloco fiscal com chave, protocolo, QR Code, URL de consulta

Se não houver impressora configurada, o `ReceiptPreview` (iframe) é exibido
para impressão via browser dialog do Chromium/Electron.

## Custos

Focus NFe cobra por nota emitida. Em **homologação** não há custo, os XMLs
são válidos só para teste (não têm valor fiscal). Sempre teste primeiro
antes de trocar para **produção**.
