# Hardware

Integrações opcionais: impressora térmica, gaveta, balança serial, leitor de
código de barras.

## Impressora térmica (ESC/POS)

Configurada em **Configurações → Impressora** via `node-thermal-printer`.

### Tipos suportados

| Tipo | Interface |
|---|---|
| USB | Nome da impressora Windows (ex.: `Impressora POS-80`) |
| Rede | `tcp://192.168.0.100:9100` |
| Serial | Porta COM |

### Larguras

- **48 colunas** (impressoras 80mm) — padrão.
- **32 colunas** (impressoras 58mm).

### Preview automático

`printer.autoPreview`:
- `always` — sempre mostra o preview em iframe (nunca imprime direto).
- `when-no-printer` — mostra preview quando não há impressora configurada.
- `never` — nunca mostra preview.

Isso é útil pra testar sem hardware.

### Botão de teste

Em Configurações → **Testar impressão** dispara um cupom de exemplo com o
nome da empresa. Se falhar, mostra o erro do driver.

## Gaveta de dinheiro

A gaveta é acionada pela impressora térmica via pulse ESC/POS.

- `printer.drawerEnabled` (bool) — liga a integração.
- `printer.drawerCode` — código do pulse (padrão 0/1, depende do modelo).

Quando ativa, o botão **Gaveta** aparece no PDV. Também é acionada automaticamente
no fechamento de venda em dinheiro (se configurado).

## Balança serial

Configurada em **Configurações → Balança**.

- Porta COM (dropdown lista as portas serial detectadas).
- Baud rate (padrão 9600).
- Protocolo: **Toledo**, **Filizola**, **Urano** ou **genérico** (parser
  simples).

### Uso no PDV

1. Digite o código do produto por peso na busca (ou clique no card).
2. Clique **Balança** — o driver lê o peso atual da porta serial.
3. Adiciona ao carrinho com `unidade = KG` e a quantidade lida.

### Teste

Em Configurações → **Testar balança** faz uma leitura única. Se falhar, o
erro (porta indisponível, protocolo errado, sem resposta) aparece.

## Leitor de código de barras

USB HID (praticamente universal) — não precisa configurar. O hook
`useBarcodeScanner` detecta o padrão de digitação rápida (< 40ms entre teclas)
seguida de Enter e chama o callback com o código.

Suporta:

- EAN-13, EAN-8, Code128, GTIN, QR (o que o leitor emitir como texto).
- EAN-13 de balança (prefixo `2` seguido de PLU + peso/preço) — resolvido
  contra `cad_produtos_codigos.tipo='BALANCA'` (ver [pdv.md](pdv.md)).

### Comportamento

- Só age quando **nenhum dialog** está aberto e o foco não está em input.
- Dentro de inputs, deixa a digitação normal.
- Fora de inputs, silenciosamente bufferiza e dispara ao pressionar Enter.

## Detecção de porta

O boot do app detecta portas seriais via `serialport` — a lista alimenta os
dropdowns em Configurações. Reload manual disponível quando pluga/despluga.

## Status no PDV

Botões **Balança** e **Gaveta** só aparecem quando o hardware está habilitado
no config (`scale.enabled`, `printer.drawerEnabled`). Assim a UI fica limpa
para lojas que não têm o hardware.
