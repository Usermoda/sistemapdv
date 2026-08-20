# Banco de dados

MariaDB 10+ (ou MySQL 8+). O schema é aplicado no primeiro `setup` a partir de
`db/schema.sql` e evolui via migrações idempotentes em
`electron/services/migrations.ts`.

## Conexão

Definida em `userData/config.json` durante o setup:

```json
{
  "database": {
    "host": "localhost",
    "port": 3307,
    "user": "root",
    "password": "…",
    "database": "sistema_pdv"
  }
}
```

O instalador (`electron/services/mysqlInstaller.ts`) tenta várias portas quando a
padrão está reservada pelo Windows (erro 10013). A porta final é gravada no
config para reuso.

## Tabelas principais

### Cadastros

| Tabela | Uso |
|---|---|
| `cad_produtos` | Produtos (nome, cod_barra, preços, estoque, fiscal) |
| `cad_produtos_tipo` | Categorias |
| `cad_produtos_codigos` | Códigos alternativos (EAN adicional, código do fornecedor, código de balança) |
| `cad_produtos_promocao` | Promoções ativas com `quantidade_minima` para tier |
| `cad_produtos_fornecedores` | Relação N:N produto ↔ fornecedor |
| `cad_clientes` | Clientes (CPF/CNPJ, endereço, contato) |
| `cad_fornecedores` | Fornecedores |
| `cad_login` | Usuários (`senha` em bcrypt) |
| `cad_perfil` | Perfis / permissões — `menu_options` guarda JSON de permissões |
| `cad_modo_lancamento` | Formas de pagamento |

### Movimento

| Tabela | Uso |
|---|---|
| `mv_caixa` | Abertura/fechamento de caixa |
| `mv_caixa_movimento` | Sangrias e suprimentos |
| `mv_vendas` | Cabeçalho da venda |
| `mv_vendas_movimento` | Itens da venda |
| `mv_lancamentos` | Financeiro (contas a pagar/receber, pagamentos da venda) |
| `mv_estoque_historico` | Histórico de entradas e ajustes (`tipo`: N/A/S/I) |
| `nfce_emitidas` | Log de emissão NFCe (chave, status, XML) |

## `cad_produtos_codigos`

Suporta múltiplos códigos por produto — evita duplicar cadastro quando o EAN
muda ou quando cada fornecedor usa uma referência diferente:

```sql
CREATE TABLE cad_produtos_codigos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_produto INT UNSIGNED NOT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'EAN',  -- EAN | FORNECEDOR | BALANCA
  codigo VARCHAR(50) NOT NULL,
  embalagem VARCHAR(20),                     -- UN, CX, DZ
  fator DOUBLE NOT NULL DEFAULT 1,
  id_fornecedor INT UNSIGNED,
  util_venda TINYINT DEFAULT 1,              -- aceito no PDV
  preferencial TINYINT DEFAULT 0,            -- código default da etiqueta
  data_inicio DATE,
  inativo TINYINT DEFAULT 0
);
```

O PDV resolve por prioridade: `cod_barra` direto → `id` → `cad_produtos_codigos.codigo`
→ EAN de balança (prefixo `2` + PLU).

## `cad_produtos_promocao`

```sql
CREATE TABLE cad_produtos_promocao (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_produto INT UNSIGNED NOT NULL,
  descricao VARCHAR(100),
  vr_promocao DOUBLE NOT NULL DEFAULT 0,
  quantidade_minima INT UNSIGNED NOT NULL DEFAULT 1,  -- aplica se qtd na venda >= isto
  data_inicio DATE NOT NULL,
  data_fim DATE,
  inativo TINYINT DEFAULT 0
);
```

Uma promoção com `quantidade_minima = 1` é aplicada sempre. Valores maiores
implementam "leve 3, pague o preço X" — a lógica de escolha do tier mais
adequado por quantidade fica no store `usePdv`, ver [pdv.md](pdv.md).

## Permissões

O campo `cad_perfil.menu_options` guarda um JSON:

```json
{ "pdv": true, "produtos": true, "config": false, ... }
```

Existe compat com o formato legado de "SSSSSN..." (S/N por posição) — ver
`src/lib/permissions.ts::parsePermissions`.

## Migrações

`electron/services/migrations.ts` roda no boot do app **e** após o setup
completar. Cada bloco é idempotente (`IF NOT EXISTS`, `columnExists()`), então
rodar múltiplas vezes é seguro. Além disso, handlers críticos de IPC (códigos,
promoções) executam um `CREATE TABLE IF NOT EXISTS` lazy na primeira chamada,
como salvaguarda extra.

Convenção de nomenclatura: `-------- NNNa: descrição --------` no cabeçalho do
bloco (ver o arquivo).

## Backup

`electron/services/backup.ts` gera um `mysqldump` completo em
`userData/backups/YYYY-MM-DD_hhmmss.sql`. Configurações → Backup permite:

- rodar backup on-demand
- agendar backup diário
- restaurar de arquivo
