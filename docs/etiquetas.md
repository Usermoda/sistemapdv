# Etiquetas

Módulo em `src/erp/etiquetas/EtiquetasPage.tsx` — geração de etiquetas de
gôndola em papel A4 ou bobina térmica.

## Formatos disponíveis

| Formato | Uso |
|---|---|
| 50×30 mm (3 colunas) | Etiqueta padrão em A4 |
| 40×25 mm (4 colunas) | Compacta em A4 |
| 60×40 mm (3 colunas) | A4 |
| 100×50 mm (2 colunas) | Grande em A4 |
| 80×40 mm bobina | Rolo térmico 80mm |
| 80×30 mm bobina | Rolo térmico 80mm |
| 90×40 mm bobina | Rolo térmico 90mm |

O layout é o mesmo em todos: nome à esquerda, embalagem, código de barras
gerado por `jsbarcode` (EAN13/EAN8/Code128 conforme o tamanho), e o **preço
grande** à direita. Bobina imprime uma etiqueta por página.

## Conteúdo configurável

Toggles no painel de formato:

- Nome do produto
- Embalagem / unidade (aparece na etiqueta, ex.: "500ML · UN")
- Código de barras (imagem)
- Número do código (texto)
- Preço
- Preço unitário (só para produtos KG/L — mostra "Preço de 1 kg = R$ x,xx")
- **Aplicar promoções ativas**

## Promoção na etiqueta

Quando o produto tem promoção ativa e "Aplicar promoções ativas" está ligado:

- **Faixa preta no topo**: "PROMOÇÃO" (ou "PROMOÇÃO · A partir de 3 un" para
  tier).
- **De R$ x,xx** riscado no canto superior direito.
- **Preço grande** em preto usa o valor promocional.
- Para produto por peso, o "Preço de 1 kg" também usa o valor promocional.

O estilo é monocromático (preto/branco) para funcionar bem em impressora
térmica.

## Impressão

- Preview inline no painel de formato (escala 2×).
- Preview expandido (`ExpandedPreview`) mostra até 8 etiquetas com o mesmo
  scaling da folha real.
- **Imprimir** dispara um `<iframe>` invisível com o HTML gerado — contorna o
  bloqueio de `window.open` do Electron. O iframe chama `window.print()` e é
  removido em ~60s.

## Adicionar produtos

- Busca por nome ou código.
- Clique adiciona 1 unidade da etiqueta; clique de novo incrementa.
- "Adicionar todos" adiciona 1 de cada produto do resultado da busca.
- Cada linha na lista de selecionados permite ajustar quantidade e remover.

## Dica de uso

Fluxo típico:

1. Criar/atualizar promoção em Preços e promoções.
2. Ir para Etiquetas.
3. Buscar os produtos afetados (ou filtrar por categoria via busca).
4. Escolher formato e imprimir.

As etiquetas refletem o que o PDV vai cobrar — inclusive tiers como "3+ un".
