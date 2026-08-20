# PDV / Caixa

Tela de venda em `src/pdv/PdvSales.tsx`. Layout dividido em:

- **Header** — link para ERP (ou logout se o usuário só tem permissão de PDV), status do caixa, atalhos F2/F4/F8.
- **Central** — busca, cards de categoria (só as com produtos), faixa "mais vendidos", grid de produtos.
- **Sidebar direito** — carrinho, cliente ativo, subtotal, total, botão FINALIZAR VENDA.

## Abertura de caixa

Ao entrar no PDV, o app procura um `mv_caixa` com `status_caixa = 'A'`. Se
não achar, abre o `CashierOpenDialog` pedindo o valor de abertura. Sem caixa
aberto o PDV fica travado.

Ao fechar (`Fechar caixa`) o `CashierCloseDialog` mostra o resumo (aberto,
vendas, sangrias, suprimentos, esperado, informado, diferença).

## Sangria / Suprimento

Botão no header abre `CashMovementDialog` — registro em `mv_caixa_movimento`
para conciliar o fechamento.

## Fluxo de venda

1. **Adicionar produto** — clique no card, digite código na busca, ou scan.
2. **Editar linha** — clique no item do carrinho para ajustar quantidade, preço unitário ou observação (`CartItemEditDialog`).
3. **Selecionar cliente** — F8 abre `ClientPickerDialog` (busca por nome, CPF, telefone).
4. **Finalizar** — F4 abre `CheckoutDialog`.

### Checkout (`CheckoutDialog`)

- Formas de pagamento carregadas de `cad_modo_lancamento` (só ativas).
- Após informar valor em um método, o restante fica pré-preenchido no próximo.
- Atalhos numéricos (1..9) selecionam o método pelo índice.
- Enter confirma a venda quando o total pago >= total.
- Após a venda, exibe **troco** (se houver) e — dependendo da config —
  o `ReceiptPreview` (cupom não fiscal em iframe).
- A venda é salva em transação: `mv_vendas` + `mv_vendas_movimento` +
  `mv_lancamentos` (um por forma de pagamento).
- Se a NFCe estiver habilitada, dispara emissão via Focus NFe em paralelo.

## Multiplicador de quantidade

Fluxo pensado para operar rápido no teclado:

1. **Digite o número** — pode estar com foco no campo de busca ou não. Aparece
   um chip azul: `12 · Enter p/ multiplicar`.
2. **Enter** — chip vira laranja: `× 12 · próximo produto`. O buffer é limpo.
3. **Adicionar o produto** — clique, scan ou digite código + Enter. A linha é
   inserida com quantidade 12; o multiplicador é consumido.
4. **Esc** ou clique no X do chip cancela.

A implementação:

- Um `useRef` guarda o multiplicador para que o callback do scanner (que roda
  em uma closure antiga) leia sempre o valor mais atual — evita race
  condition entre o `setState` e o disparo síncrono do scan.
- Bursts rápidos (< 50ms entre teclas) são detectados como scan e ignoram a
  captura para o multiplicador.
- Formato legado `12*7894...` no campo de busca ainda funciona para lançamento
  one-shot.

## Scanner de código de barras

`src/hooks/useBarcodeScanner.ts` intercepta `keydown` global e detecta o padrão
de leitor USB HID (rajada de teclas com < 40ms de gap seguidas de Enter).

- Se o scanner detecta um scan, o callback é chamado com o código completo.
- Se o padrão for teclado manual, o hook ignora — assim o usuário pode digitar
  normalmente na busca.
- Códigos EAN-13 iniciados com `2` (padrão de balança) são resolvidos por
  prefixo contra `cad_produtos_codigos.tipo='BALANCA'`.

## Promoção no PDV

Ao abrir o caixa, o PDV carrega todas as promoções ativas via
`api.pdv.listActivePromoTiers()` e mantém em cache no store. Em qualquer
mudança de quantidade (`addItem`, `increment`, `setQuant`), o store escolhe o
melhor tier aplicável.

- **Tier com `quantidade_minima = 1`** → sempre aplica.
- **Tier com `quantidade_minima = 3`** → só ativa quando a linha tem 3+ unidades.
- Se a qtd cair abaixo do tier, o preço volta para `valor_base` (preço
  original).

Ver [precos-promocoes.md](precos-promocoes.md).

## Balança e gaveta

- **Balança** — botão só aparece se `scale.enabled` estiver salvo. Clique lê o
  peso atual da porta serial e adiciona ao produto atualmente na busca
  (unidade KG/L).
- **Gaveta** — botão só aparece se `printer.drawerEnabled = true` e a
  impressora estiver configurada. Envia o pulse ESC/POS.

## Vendas recentes

`RecentSalesDialog` (botão *Últimas vendas*) lista as últimas 20 vendas do
próprio caixa, permitindo reimprimir cupom.

## Ociosidade

Para operadores só-PDV, `useIdleTimeout` faz logout automático após N minutos
ociosos (configurável em Configurações → Segurança). Movimentos de mouse e
teclado zeram o timer.
