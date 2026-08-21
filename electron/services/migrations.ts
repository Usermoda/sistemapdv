import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { Pool, RowDataPacket } from './db';
import { getPool, executeSchema, type ConnectionConfig } from './db';
import { getConfig } from './config';

// ==========================================================================
// Helpers de introspection (dialeto PostgreSQL)
// ==========================================================================

async function tableExists(pool: Pool, table: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_name = ?`,
    [table]
  );
  return Number((rows[0] as { c: string | number } | undefined)?.c ?? 0) > 0;
}

async function columnExists(pool: Pool, table: string, column: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  return Number((rows[0] as { c: string | number } | undefined)?.c ?? 0) > 0;
}

// ==========================================================================
// Verificação de tabelas essenciais
// ==========================================================================

const CORE_TABLES = [
  'cad_empresa',
  'cad_login',
  'cad_login_perfil',
  'cad_produtos',
  'cad_produtos_tipo',
  'cad_produtos_fornecedores',
  'cad_clientes',
  'cad_fornecedores',
  'cad_modo_lancamento',
  'cad_conta',
  'cad_planejamento',
  'cad_lancamentos',
  'mv_caixa',
  'mv_vendas',
  'mv_vendas_movimento',
  'mv_estoque_historico',
];

async function findSchemaFile(): Promise<string | null> {
  const candidates = [
    path.join(process.env.APP_ROOT ?? '', 'db', 'schema.pg.sql'),
    path.join(app.getAppPath(), 'db', 'schema.pg.sql'),
    path.join(process.resourcesPath ?? '', 'app.asar', 'db', 'schema.pg.sql'),
    path.join(process.resourcesPath ?? '', 'db', 'schema.pg.sql'),
  ];
  for (const c of candidates) {
    try {
      await fs.access(c);
      return c;
    } catch {
      // continua
    }
  }
  return null;
}

async function ensureCoreTables(pool: Pool): Promise<string[]> {
  const missing: string[] = [];
  for (const t of CORE_TABLES) {
    if (!(await tableExists(pool, t))) missing.push(t);
  }
  if (missing.length === 0) return [];

  console.warn(`[migrations] Tabelas essenciais faltando: ${missing.join(', ')}. Aplicando schema.pg.sql...`);
  const schemaFile = await findSchemaFile();
  if (!schemaFile) {
    console.error('[migrations] schema.pg.sql não encontrado.');
    return missing;
  }
  const cfg = getConfig();
  const conn: ConnectionConfig = {
    host: cfg.get('db.host') ?? '127.0.0.1',
    port: cfg.get('db.port') ?? 5432,
    user: cfg.get('db.user') ?? 'postgres',
    password: cfg.get('db.password') ?? '',
  };
  const database = cfg.get('db.database') ?? 'sistema_pdv';
  try {
    const sql = await fs.readFile(schemaFile, 'utf8');
    const r = await executeSchema(conn, database, sql);
    console.log(`[migrations] schema.pg.sql aplicado: ${r.statements} statements, ${r.failures.length} falha(s).`);
  } catch (e) {
    console.error('[migrations] Falha ao aplicar schema.pg.sql:', (e as Error).message);
  }

  const stillMissing: string[] = [];
  for (const t of CORE_TABLES) {
    if (!(await tableExists(pool, t))) stillMissing.push(t);
  }
  if (stillMissing.length > 0) {
    console.error(`[migrations] Ainda faltam: ${stillMissing.join(', ')}.`);
  } else {
    console.log('[migrations] Todas as tabelas essenciais OK.');
  }
  return stillMissing;
}

// ==========================================================================
// Migrations idempotentes (dialeto PostgreSQL)
// ==========================================================================

export async function runMigrations(): Promise<void> {
  let pool: Pool;
  try {
    pool = await getPool();
  } catch {
    return; // DB não configurado ainda
  }

  // -------- 000: Verificar tabelas essenciais --------
  await ensureCoreTables(pool);

  // -------- 001: Colunas fiscais em cad_produtos --------
  const fiscalCols: Array<[string, string]> = [
    ['ncm', 'VARCHAR(10)'],
    ['cfop', 'VARCHAR(5)'],
    ['cst_csosn', 'VARCHAR(4)'],
    ['cest', 'VARCHAR(10)'],
    ['origem_produto', 'SMALLINT'],
  ];
  for (const [col, ty] of fiscalCols) {
    if (!(await columnExists(pool, 'cad_produtos', col))) {
      await pool.query(`ALTER TABLE cad_produtos ADD COLUMN ${col} ${ty}`);
    }
  }

  // -------- 002: Colunas de ajuste de estoque --------
  if (!(await columnExists(pool, 'mv_estoque_historico', 'tipo'))) {
    await pool.query(`ALTER TABLE mv_estoque_historico ADD COLUMN tipo CHAR(1) DEFAULT 'N'`);
  }
  if (!(await columnExists(pool, 'mv_estoque_historico', 'motivo'))) {
    await pool.query(`ALTER TABLE mv_estoque_historico ADD COLUMN motivo VARCHAR(255)`);
  }

  // -------- 003: Inativo em formas de pagamento --------
  if (!(await columnExists(pool, 'cad_modo_lancamento', 'inativo'))) {
    await pool.query(`ALTER TABLE cad_modo_lancamento ADD COLUMN inativo SMALLINT DEFAULT 0`);
  }

  // -------- 004: cad_produtos_codigos (garantia final se schema não criou) --------
  if (!(await tableExists(pool, 'cad_produtos_codigos'))) {
    await pool.query(`
      CREATE TABLE cad_produtos_codigos (
        id            INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        id_produto    INTEGER NOT NULL,
        tipo          VARCHAR(20) NOT NULL DEFAULT 'EAN',
        codigo        VARCHAR(50) NOT NULL,
        embalagem     VARCHAR(20),
        fator         DOUBLE PRECISION NOT NULL DEFAULT 1,
        id_fornecedor INTEGER,
        util_venda    SMALLINT DEFAULT 1,
        preferencial  SMALLINT DEFAULT 0,
        data_inicio   DATE,
        inativo       SMALLINT DEFAULT 0,
        data_criacao  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_cad_produtos_codigos_produto ON cad_produtos_codigos(id_produto)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_cad_produtos_codigos_codigo ON cad_produtos_codigos(codigo)');
  }

  // -------- 005: cad_produtos_promocao (idem) --------
  if (!(await tableExists(pool, 'cad_produtos_promocao'))) {
    await pool.query(`
      CREATE TABLE cad_produtos_promocao (
        id                INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        id_produto        INTEGER NOT NULL,
        descricao         VARCHAR(100),
        vr_promocao       DOUBLE PRECISION NOT NULL DEFAULT 0,
        quantidade_minima INTEGER NOT NULL DEFAULT 1,
        data_inicio       DATE NOT NULL,
        data_fim          DATE,
        inativo           SMALLINT DEFAULT 0,
        data_criacao      TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_cad_produtos_promocao_produto ON cad_produtos_promocao(id_produto)');
  }
  if (!(await columnExists(pool, 'cad_produtos_promocao', 'quantidade_minima'))) {
    await pool.query('ALTER TABLE cad_produtos_promocao ADD COLUMN quantidade_minima INTEGER NOT NULL DEFAULT 1');
  }

  // -------- 006: mv_caixa_movimento (sangria/suprimento) --------
  if (!(await tableExists(pool, 'mv_caixa_movimento'))) {
    await pool.query(`
      CREATE TABLE mv_caixa_movimento (
        id         INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        id_caixa   INTEGER NOT NULL,
        tipo       CHAR(1) NOT NULL,
        descricao  VARCHAR(255),
        valor      DOUBLE PRECISION NOT NULL DEFAULT 0,
        data_hora  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        id_login   INTEGER
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mv_caixa_movimento_caixa ON mv_caixa_movimento(id_caixa)');
  }

  // -------- 007: nfce_emitidas --------
  if (!(await tableExists(pool, 'nfce_emitidas'))) {
    await pool.query(`
      CREATE TABLE nfce_emitidas (
        id                INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        id_venda          INTEGER NOT NULL,
        controle_venda    VARCHAR(14) NOT NULL,
        ref_externa       VARCHAR(50) NOT NULL,
        provider          VARCHAR(30) DEFAULT 'focusnfe',
        ambiente          VARCHAR(15) DEFAULT 'homologacao',
        status            VARCHAR(30) DEFAULT 'pendente',
        chave_nfe         VARCHAR(60),
        numero            INTEGER,
        serie             INTEGER,
        protocolo         VARCHAR(30),
        url_danfe         TEXT,
        url_xml           TEXT,
        qrcode_url        TEXT,
        mensagem_sefaz    TEXT,
        payload_json      TEXT,
        response_json     TEXT,
        data_emissao      TIMESTAMP,
        data_atualizacao  TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS uk_nfce_emitidas_ref ON nfce_emitidas(ref_externa)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_nfce_emitidas_venda ON nfce_emitidas(id_venda)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_nfce_emitidas_status ON nfce_emitidas(status)');
  }
}
