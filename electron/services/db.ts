import mysql from 'mysql2/promise';
import { getConfig } from './config';

let pool: mysql.Pool | null = null;

export type ConnectionConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
};

/**
 * Verifica se o servidor conectado tem o storage engine InnoDB disponível.
 * O PDV depende de InnoDB (transações + foreign keys); um servidor com
 * `skip-innodb` (have_innodb = DISABLED) faz qualquer CREATE TABLE ... ENGINE=InnoDB
 * falhar com "Unknown storage engine 'InnoDB'".
 */
export async function checkInnodbSupport(conn: mysql.Connection): Promise<boolean> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    "SELECT SUPPORT FROM information_schema.ENGINES WHERE ENGINE = 'InnoDB'"
  );
  const support = String(rows[0]?.SUPPORT ?? '').toUpperCase();
  return support === 'YES' || support === 'DEFAULT';
}

export async function testConnection(
  cfg: ConnectionConfig
): Promise<{ ok: boolean; error?: string; version?: string; innodb?: boolean }> {
  try {
    const conn = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      connectTimeout: 5000,
    });
    const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT VERSION() as v');
    const innodb = await checkInnodbSupport(conn);
    await conn.end();
    return { ok: true, version: rows[0]?.v as string, innodb };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function listDatabases(cfg: ConnectionConfig): Promise<string[]> {
  const conn = await mysql.createConnection({ ...cfg, connectTimeout: 5000 });
  try {
    const [rows] = await conn.query<mysql.RowDataPacket[]>('SHOW DATABASES');
    return rows.map((r) => r.Database as string);
  } finally {
    await conn.end();
  }
}

export async function createDatabase(cfg: ConnectionConfig, name: string): Promise<void> {
  const conn = await mysql.createConnection({ ...cfg, connectTimeout: 5000 });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${name}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await conn.end();
  }
}

export async function executeSchema(
  cfg: ConnectionConfig,
  database: string,
  sql: string,
  onProgress?: (msg: string, pct: number) => void
): Promise<{ statements: number; failures: Array<{ preview: string; error: string }> }> {
  const conn = await mysql.createConnection({
    ...cfg,
    database,
    multipleStatements: true,
    connectTimeout: 10000,
  });
  try {
    const statements = splitSqlStatements(sql);
    let done = 0;
    const failures: Array<{ preview: string; error: string }> = [];
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      try {
        await conn.query(trimmed);
      } catch (e) {
        const msg = (e as Error).message;
        // Tolera "já existe / duplicado" (schema idempotente).
        // Loga mas continua nos demais erros — apply best-effort e reporta.
        if (!/exists|Duplicate/i.test(msg)) {
          const preview = trimmed.replace(/\s+/g, ' ').slice(0, 120);
          failures.push({ preview, error: msg });
          console.warn('[executeSchema] statement falhou:', preview, '→', msg);
        }
      }
      done++;
      onProgress?.(`Aplicando estrutura ${done}/${statements.length}`, Math.round((done / statements.length) * 100));
    }
    if (failures.length > 0) {
      console.warn(`[executeSchema] ${failures.length} statement(s) falharam. As tabelas correspondentes NÃO foram criadas — verifique os logs acima.`);
    }
    return { statements: done, failures };
  } finally {
    await conn.end();
  }
}

function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const prev = sql[i - 1];
    if (c === "'" && prev !== '\\' && !inDouble && !inBacktick) inSingle = !inSingle;
    else if (c === '"' && prev !== '\\' && !inSingle && !inBacktick) inDouble = !inDouble;
    else if (c === '`' && !inSingle && !inDouble) inBacktick = !inBacktick;
    if (c === ';' && !inSingle && !inDouble && !inBacktick) {
      out.push(buf);
      buf = '';
      continue;
    }
    buf += c;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

export async function getPool(): Promise<mysql.Pool> {
  if (pool) return pool;
  const cfg = getConfig();
  const host = cfg.get('db.host');
  const database = cfg.get('db.database');
  if (!host || !database) throw new Error('Banco de dados não configurado');
  pool = mysql.createPool({
    host,
    port: cfg.get('db.port') ?? 3306,
    user: cfg.get('db.user') ?? 'root',
    password: cfg.get('db.password') ?? '',
    database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
  });
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
