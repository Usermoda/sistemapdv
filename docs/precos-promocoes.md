# Preços e promoções

Módulo em `src/erp/precos/PrecosPage.tsx`, dividido em duas abas.

## Aba: Preços

Edição em massa dos preços de todos os produtos.

- Filtro por categoria e por "margem baixa" (< 20%).
- Colunas editáveis: **Compra**, **Venda**, **Atacado (venda 2)**.
- **Margem em tempo real** calculada pelo custo × venda.
- **Aplicar markup em N** — seleciona vários e aplica um percentual sobre o
  custo (`vr_venda = vr_compra × (1 + markup%)`) ou sobre o preço atual
  (reajuste).
- **Salvar** faz um `bulk-update` transacional em `cad_produtos`.

Rótulo "Em promoção: R$ x,xx" aparece na linha quando o produto tem promoção
ativa. Para tier > 1, o rótulo mostra "a partir de N un".

## Aba: Promoções

Lista todas as promoções (`cad_produtos_promocao`) com filtro por status:

- **Ativa** — dentro do período, `inativo=0`.
- **Agendada** — `data_inicio` no futuro.
- **Expirada** — `data_fim < hoje`.
- **Pausada** — `inativo=1`.

Ações por linha: **Ativar/Pausar**, **Remover**.

### Nova promoção

Dialog que aceita **preço por produto** e **quantidade mínima por produto**:

1. Descrição da campanha (opcional, ex.: "Semana do consumidor").
2. Período (início / fim opcional).
3. Buscar e selecionar produtos.
4. Para cada produto na lista:
   - **Preço promo (R$)** — editável.
   - **A partir de** — quantidade mínima que ativa o preço (1 = sempre).
5. **Quick-fills** para aplicar em todos os selecionados de uma vez:
   - Aplicar desconto %.
   - Aplicar preço fixo.
   - Aplicar quantidade mínima.

Salvar cria uma linha por produto em `cad_produtos_promocao`.

## Comportamento no PDV

Ao abrir o caixa, o PDV carrega **todas** as promoções ativas em cache
(`usePdv.setPromoTiers`). O store re-calcula o preço de cada item do carrinho
quando:

- um item é adicionado
- a quantidade muda (increment/setQuant)
- a lista de tiers é atualizada

Regra de escolha (`resolvePrice` em `src/stores/pdvStore.ts`):

1. Filtrar tiers do produto onde `qty >= quantidade_minima` e `vr_promocao > 0`.
2. Ordenar por `quantidade_minima` desc (prefere o tier mais alto aplicável).
3. Se algum dos aplicáveis é menor que `valor_base`, usa ele; senão fica no
   base.

Sinalizações no carrinho:

- Badge `PROMO` ou `Nx un` ao lado do nome do item.
- Preço original riscado, preço promocional em destaque.

## Comportamento na etiqueta

O módulo de etiquetas também respeita as promoções (ver [etiquetas.md](etiquetas.md)):

- Faixa preta "PROMOÇÃO" (ou "PROMOÇÃO · A partir de N un") no topo.
- "De R$ x,xx" riscado, novo preço em destaque.
- Toggle "Aplicar promoções ativas" pra imprimir sem promoção quando quiser.

## Emissão fiscal

A NFCe usa **sempre** o preço final da linha (o que foi cobrado no PDV,
incluindo o desconto de tier) — o cupom fiscal reflete o valor real recebido.
