import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { getPool, executeSchema, type ConnectionConfig } from './db';
import { getConfig } from './config';

async function columnExists(pool: Pool, table: string, column: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return (rows[0] as { c: number }).c > 0;
}

async function tableExists(pool: Pool, table: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return (rows[0] as { c: number }).c > 0;
}

/**
 * Tabelas que o app queries em runtime — sem elas ele quebra.
 * Se qualquer uma faltar no boot, re-executamos o schema.sql (idempotente
 * com IF NOT EXISTS) para preencher as lacunas.
 */
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

/**
 * Localiza o schema.sql tanto em dev (raiz do projeto) quanto em prod
 * (empacotado dentro do resources/app.asar/db/schema.sql).
 */
async function findSchemaFile(): Promise<string | null> {
  const candidates = [
    path.join(process.env.APP_ROOT ?? '', 'db', 'schema.sql'),
    path.join(app.getAppPath(), 'db', 'schema.sql'),
    path.join(process.resourcesPath ?? '', 'app.asar', 'db', 'schema.sql'),
    path.join(process.resourcesPath ?? '', 'db', 'schema.sql'),
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

/**
 * Verifica todas as tabelas essenciais e, se faltar alguma, re-aplica o
 * schema.sql (idempotente) para tentar recriar. Retorna a lista final de
 * tabelas faltantes (idealmente vazia).
 */
async function ensureCoreTables(pool: Pool): Promise<string[]> {
  const missing: string[] = [];
  for (const t of CORE_TABLES) {
    if (!(await tableExists(pool, t))) missing.push(t);
  }
  if (missing.length === 0) return [];

  console.warn(`[migrations] Tabelas essenciais faltando: ${missing.join(', ')}. Tentando re-aplicar schema.sql...`);
  const schemaFile = await findSchemaFile();
  if (!schemaFile) {
    console.error('[migrations] schema.sql não encontrado — não é possível recriar tabelas faltantes automaticamente.');
    return missing;
  }
  const cfg = getConfig();
  const conn: ConnectionConfig = {
    host: cfg.get('db.host') ?? '127.0.0.1',
    port: cfg.get('db.port') ?? 3306,
    user: cfg.get('db.user') ?? 'root',
    password: cfg.get('db.password') ?? '',
  };
  const database = cfg.get('db.database') ?? 'sistema_pdv';
  try {
    const sql = await fs.readFile(schemaFile, 'utf8');
    const r = await executeSchema(conn, database, sql);
    console.log(`[migrations] schema.sql re-aplicado: ${r.statements} statements, ${r.failures.length} falha(s).`);
  } catch (e) {
    console.error('[migrations] Falha ao re-aplicar schema.sql:', (e as Error).message);
  }

  // Verifica de novo — o que ainda falta?
  const stillMissing: string[] = [];
  for (const t of CORE_TABLES) {
    if (!(await tableExists(pool, t))) stillMissing.push(t);
  }
  if (stillMissing.length > 0) {
    console.error(`[migrations] Tabelas ainda faltando após re-aplicar schema.sql: ${stillMissing.join(', ')}. Verifique manualmente.`);
  } else {
    console.log('[migrations] Todas as tabelas essenciais estão OK agora.');
  }
  return stillMissing;
}

/**
 * Runs idempotent migrations on startup. Safe to call every time — each step
 * checks if the change is already applied.
 */
export async function runMigrations(): Promise<void> {
  let pool: Pool;
  try {
    pool = await getPool();
  } catch {
    // DB not configured yet — will run again after setup completes
    return;
  }

  // -------- 000: Verificar tabelas essenciais e recriar se faltarem --------
  await ensureCoreTables(pool);

  // -------- 000: Auth — password column widening --------
  const [passwordCol] = await pool.query<RowDataPacket[]>(
    `SELECT CHARACTER_MAXIMUM_LENGTH AS len FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cad_login' AND COLUMN_NAME = 'senha'`
  );
  const currentLen = passwordCol[0] ? (passwordCol[0] as { len: number }).len : 0;
  if (currentLen && currentLen < 255) {
    await pool.query(`ALTER TABLE cad_login MODIFY COLUMN senha VARCHAR(255) DEFAULT NULL`);
  }

  // -------- 000c: Stock adjustment tracking columns --------
  if (!(await columnExists(pool, 'mv_estoque_historico', 'tipo'))) {
    await pool.query(`ALTER TABLE mv_estoque_historico ADD COLUMN tipo CHAR(1) DEFAULT 'N' COMMENT 'N=nota, A=ajuste+, S=ajuste-, I=inventário'`);
  }
  if (!(await columnExists(pool, 'mv_estoque_historico', 'motivo'))) {
    await pool.query(`ALTER TABLE mv_estoque_historico ADD COLUMN motivo VARCHAR(255) DEFAULT NULL`);
  }

  // -------- 000b: Inativo column on payment methods --------
  if (!(await columnExists(pool, 'cad_modo_lancamento', 'inativo'))) {
    await pool.query(`ALTER TABLE cad_modo_lancamento ADD COLUMN inativo int(4) unsigned DEFAULT 0`);
  }

  // -------- 001: Fiscal fields on products --------
  const productFiscalCols: Array<[string, string]> = [
    ['ncm', "varchar(10) default NULL"],
    ['cfop', "varchar(5) default NULL"],
    ['cst_csosn', "varchar(4) default NULL"],
    ['cest', "varchar(10) default NULL"],
  ];
  for (const [col, definition] of productFiscalCols) {
    if (!(await columnExists(pool, 'cad_produtos', col))) {
      await pool.query(`ALTER TABLE cad_produtos ADD COLUMN \`${col}\` ${definition}`);
    }
  }

  // -------- 004: Product alternative codes (EAN, supplier codes, internal) --------
  if (!(await tableExists(pool, 'cad_produtos_codigos'))) {
    await pool.query(`
      CREATE TABLE cad_produtos_codigos (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_produto INT UNSIGNED NOT NULL,
        tipo VARCHAR(20) NOT NULL DEFAULT 'EAN' COMMENT 'EAN, FORNECEDOR, INTERNO',
        codigo VARCHAR(50) NOT NULL,
        embalagem VARCHAR(20) DEFAULT NULL COMMENT 'Ex: UN, CX, DZ',
        fator DOUBLE NOT NULL DEFAULT 1 COMMENT 'Quantidade por embalagem (ex: caixa com 12)',
        id_fornecedor INT UNSIGNED DEFAULT NULL,
        util_venda TINYINT DEFAULT 1 COMMENT 'Aceito no PDV',
        preferencial TINYINT DEFAULT 0 COMMENT 'Código preferencial p/ etiqueta',
        data_inicio DATE DEFAULT NULL,
        inativo TINYINT DEFAULT 0,
        data_criacao TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_produto (id_produto),
        KEY idx_codigo (codigo),
        KEY idx_fornecedor (id_fornecedor)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  // -------- 003: Promotions table --------
  if (!(await tableExists(pool, 'cad_produtos_promocao'))) {
    await pool.query(`
      CREATE TABLE cad_produtos_promocao (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_produto INT UNSIGNED NOT NULL,
        descricao VARCHAR(100) DEFAULT NULL,
        vr_promocao DOUBLE NOT NULL DEFAULT 0,
        quantidade_minima INT UNSIGNED NOT NULL DEFAULT 1,
        data_inicio DATE NOT NULL,
        data_fim DATE DEFAULT NULL,
        inativo TINYINT DEFAULT 0 COMMENT '1 = pausada',
        data_criacao TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_produto (id_produto),
        KEY idx_ativo (inativo, data_inicio, data_fim)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  // -------- 002a: Cashier movement (sangria/suprimento) --------
  if (!(await tableExists(pool, 'mv_caixa_movimento'))) {
    await pool.query(`
      CREATE TABLE mv_caixa_movimento (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_caixa INT UNSIGNED NOT NULL,
        tipo CHAR(1) NOT NULL COMMENT 'S=Sangria, A=Aporte/Suprimento',
        descricao VARCHAR(255) DEFAULT NULL,
        valor DOUBLE NOT NULL DEFAULT 0,
        data_hora TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        id_login INT UNSIGNED DEFAULT NULL,
        PRIMARY KEY (id),
        KEY idx_caixa (id_caixa),
        KEY idx_tipo (tipo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  // -------- 002: NFCe emissions table --------
  if (!(await tableExists(pool, 'nfce_emitidas'))) {
    await pool.query(`
      CREATE TABLE nfce_emitidas (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_venda INT UNSIGNED NOT NULL,
        controle_venda VARCHAR(14) NOT NULL,
        ref_externa VARCHAR(50) NOT NULL,
        provider VARCHAR(30) DEFAULT 'focusnfe',
        ambiente VARCHAR(15) DEFAULT 'homologacao',
        status VARCHAR(30) DEFAULT 'pendente',
        chave_nfe VARCHAR(60) DEFAULT NULL,
        numero INT UNSIGNED DEFAULT NULL,
        serie INT UNSIGNED DEFAULT NULL,
        protocolo VARCHAR(30) DEFAULT NULL,
        url_danfe TEXT DEFAULT NULL,
        url_xml TEXT DEFAULT NULL,
        qrcode_url TEXT DEFAULT NULL,
        mensagem_sefaz TEXT DEFAULT NULL,
        payload_json LONGTEXT DEFAULT NULL,
        response_json LONGTEXT DEFAULT NULL,
        data_emissao DATETIME DEFAULT NULL,
        data_atualizacao TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_ref (ref_externa),
        KEY idx_venda (id_venda),
        KEY idx_status (status),
        KEY idx_chave (chave_nfe)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }
}
