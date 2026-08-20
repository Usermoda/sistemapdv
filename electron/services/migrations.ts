import type { Pool, RowDataPacket } from 'mysql2/promise';
import { getPool } from './db';

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
