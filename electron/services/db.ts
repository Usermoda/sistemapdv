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

export async function testConnection(cfg: ConnectionConfig): Promise<{ ok: boolean; error?: string; version?: string }> {
  try {
    const conn = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      connectTimeout: 5000,
    });
    const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT VERSION() as v');
    await conn.end();
    return { ok: true, version: rows[0]?.v as string };
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
): Promise<{ statements: number }> {
  const conn = await mysql.createConnection({
    ...cfg,
    database,
    multipleStatements: true,
    connectTimeout: 10000,
  });
  try {
    const statements = splitSqlStatements(sql);
    let done = 0;
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      try {
        await conn.query(trimmed);
      } catch (e) {
        const msg = (e as Error).message;
        if (!/exists|Duplicate/i.test(msg)) throw e;
      }
      done++;
      onProgress?.(`Aplicando estrutura ${done}/${statements.length}`, Math.round((done / statements.length) * 100));
    }
    return { statements: done };
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
