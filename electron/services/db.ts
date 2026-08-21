import pg from 'pg';
import { getConfig } from './config';

/**
 * Migração MySQL → PostgreSQL
 * -----------------------------------------------------------------------------
 * A camada de banco agora usa `pg` mas expõe uma API compat com `mysql2/promise`
 * pra não quebrar os ~15 arquivos IPC que fazem `pool.query('SELECT ... ?', [x])`.
 *
 * O que o adapter faz automaticamente:
 * - Traduz placeholders `?` → `$1, $2, $3...` (PG usa numerados)
 * - Remove backticks `` `nome` `` → `nome` (PG usa aspas duplas, mas identificadores
 *   simples funcionam sem aspas)
 * - Retorna `[rows, fields]` (tuple mysql2) — o segundo item é vazio, ninguém usa
 * - Em INSERT sem RETURNING, adiciona `RETURNING id` e coloca em `insertId`
 *
 * O que o desenvolvedor precisa cuidar por query (poucos casos):
 * - `CURRENT_DATE`   → `CURRENT_DATE`
 * - `NOW()`        → OK (funciona igual)
 * - `YEAR(x)/MONTH(x)` → `EXTRACT(YEAR FROM x)` / `EXTRACT(MONTH FROM x)`
 * - `IFNULL(a,b)` → `COALESCE(a,b)`
 * - `ON DUPLICATE KEY UPDATE` → `ON CONFLICT ... DO UPDATE SET`
 * - `LAST_INSERT_ID()` → não precisa; use `insertId` do result (populado pelo adapter)
 */

// ==== Tipos re-exportados (compat com mysql2) ============================

export type RowDataPacket = Record<string, unknown>;

export type ResultSetHeader = {
  insertId: number;
  affectedRows: number;
  changedRows: number;
};

export type ConnectionConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
};

// ==== Adapter core =======================================================

let pgPool: pg.Pool | null = null;

/**
 * Reescreve uma query MySQL pra PG:
 * - Substitui `?` (não dentro de strings) por `$1, $2, $3, ...`
 * - Remove backticks — identificadores minúsculos sem aspas funcionam em PG
 */
function rewriteSql(sql: string): string {
  let out = '';
  let n = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const prev = sql[i - 1];
    if (c === "'" && prev !== '\\' && !inDouble) inSingle = !inSingle;
    else if (c === '"' && prev !== '\\' && !inSingle) inDouble = !inDouble;

    if (!inSingle && !inDouble) {
      if (c === '?') {
        n++;
        out += '$' + n;
        continue;
      }
      if (c === '`') continue; // strip backticks
    }
    out += c;
  }
  return out;
}

/**
 * Se for INSERT sem RETURNING, adiciona `RETURNING id` pra popular insertId.
 * Retorna null quando não é um INSERT (pra saber se precisa parsear o retorno).
 */
function ensureInsertReturning(sql: string): { sql: string; wasInsertWithoutReturning: boolean } {
  const trimmed = sql.trim();
  const isInsert = /^INSERT\s+/i.test(trimmed);
  if (!isInsert) return { sql, wasInsertWithoutReturning: false };
  if (/\bRETURNING\b/i.test(trimmed)) return { sql, wasInsertWithoutReturning: false };
  const withoutSemi = trimmed.replace(/;\s*$/, '');
  return { sql: withoutSemi + ' RETURNING id', wasInsertWithoutReturning: true };
}

interface QueryResult<T> {
  0: T;
  1: unknown[];
  length: 2;
  [Symbol.iterator](): IterableIterator<T | unknown[]>;
}

async function runQuery<T = unknown>(
  client: pg.PoolClient | pg.Pool | pg.Client,
  sql: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const rewritten = rewriteSql(sql);
  const { sql: finalSql, wasInsertWithoutReturning } = ensureInsertReturning(rewritten);
  try {
    const r = await client.query({ text: finalSql, values: params as unknown[] });
    if (wasInsertWithoutReturning) {
      const insertId = (r.rows?.[0] as { id?: number } | undefined)?.id ?? 0;
      const header: ResultSetHeader = {
        insertId: Number(insertId) || 0,
        affectedRows: r.rowCount ?? 0,
        changedRows: r.rowCount ?? 0,
      };
      return makeTuple<T>(header as unknown as T);
    }
    // Se é uma INSERT/UPDATE/DELETE explicito, ainda retornamos ResultSetHeader-like
    if (/^(UPDATE|DELETE)\s+/i.test(finalSql.trim())) {
      const header: ResultSetHeader = {
        insertId: 0,
        affectedRows: r.rowCount ?? 0,
        changedRows: r.rowCount ?? 0,
      };
      return makeTuple<T>(header as unknown as T);
    }
    return makeTuple<T>(r.rows as unknown as T);
  } catch (e) {
    // Anexa a query traduzida na mensagem pra facilitar debug
    (e as Error).message = `${(e as Error).message}\n[SQL] ${finalSql}`;
    throw e;
  }
}

function makeTuple<T>(rows: T): QueryResult<T> {
  const tuple: unknown = [rows, []];
  return tuple as QueryResult<T>;
}

// ==== Wrapper com API mysql2 =============================================

export interface CompatConnection {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
  end(): Promise<void>;
}

export interface CompatPool {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  getConnection(): Promise<CompatConnection>;
  end(): Promise<void>;
}

function wrapPool(rawPool: pg.Pool): CompatPool {
  return {
    query: (sql, params) => runQuery(rawPool, sql, params),
    async getConnection() {
      const client = await rawPool.connect();
      return wrapClient(client);
    },
    end: () => rawPool.end(),
  };
}

function wrapClient(client: pg.PoolClient): CompatConnection {
  return {
    query: (sql, params) => runQuery(client, sql, params),
    beginTransaction: async () => {
      await client.query('BEGIN');
    },
    commit: async () => {
      await client.query('COMMIT');
    },
    rollback: async () => {
      await client.query('ROLLBACK');
    },
    release: () => client.release(),
    end: async () => client.release(),
  };
}

// ==== APIs públicas (mesma superficie de antes) ==========================

/**
 * Sem `client_encoding: 'UTF8'` o PG do Windows envia mensagens de erro em
 * Windows-1252 (locale do sistema) e o Node interpreta como UTF-8 — resultado:
 * caracteres acentuados viram U+FFFD (o "�" de replacement).
 * Isso ajuda pra queries pós-auth; erros de autenticação chegam antes do
 * client_encoding entrar em vigor, então também usamos `pgErrorMessage` abaixo.
 */
const PG_CONN_DEFAULTS = { client_encoding: 'UTF8' } as const;

/**
 * Erros de auth/conexão do PG chegam no locale do servidor (Windows-1252
 * no Windows brasileiro), viram lixo `����` quando decodificados como UTF-8.
 * Como o SQLSTATE é ASCII e estável, mapeamos por código para textos limpos.
 * Fora dos códigos conhecidos, strippamos os U+FFFD e devolvemos o resto.
 */
type PgError = Error & { code?: string };

export function pgErrorMessage(err: unknown): string {
  const e = err as PgError;
  const code = e?.code;
  const rawMsg = e?.message ?? String(err);
  const hasGarbled = /�/.test(rawMsg);
  const clean = () => rawMsg.replace(/�+/g, '').replace(/\s+/g, ' ').trim();

  switch (code) {
    case '28P01':
      return 'Senha incorreta para o usuário informado.';
    case '28000':
      return 'Usuário sem permissão para conectar (verifique pg_hba.conf).';
    case '3D000':
      return 'Banco de dados informado não existe.';
    case '3F000':
      return 'Schema informado não existe.';
    case '08P01':
      return 'Falha no protocolo PostgreSQL — a porta responde algo que não é PG.';
    case '08001':
    case 'ECONNREFUSED':
      return 'Não foi possível conectar ao servidor PostgreSQL nesse host/porta.';
    case 'ETIMEDOUT':
      return 'Tempo esgotado ao conectar no servidor PostgreSQL.';
    case '42501':
      return 'Permissão negada.';
  }
  return hasGarbled ? clean() || 'Falha ao conectar ao PostgreSQL.' : rawMsg;
}

export async function testConnection(
  cfg: ConnectionConfig
): Promise<{ ok: boolean; error?: string; version?: string }> {
  const client = new pg.Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    // Se `database` não vier, conecta ao banco `postgres` padrão só pra testar login
    database: cfg.database || 'postgres',
    connectionTimeoutMillis: 5000,
    ...PG_CONN_DEFAULTS,
  });
  try {
    await client.connect();
    const r = await client.query('SELECT version() AS v');
    await client.end();
    return { ok: true, version: r.rows[0]?.v as string };
  } catch (err) {
    return { ok: false, error: pgErrorMessage(err) };
  }
}

export async function listDatabases(cfg: ConnectionConfig): Promise<string[]> {
  const client = new pg.Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: 'postgres',
    connectionTimeoutMillis: 5000,
    ...PG_CONN_DEFAULTS,
  });
  try {
    await client.connect();
    const r = await client.query(
      "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname"
    );
    return r.rows.map((row) => row.datname as string);
  } catch (err) {
    throw new Error(pgErrorMessage(err));
  } finally {
    await client.end().catch(() => {});
  }
}

export async function createDatabase(cfg: ConnectionConfig, name: string): Promise<void> {
  // Nomes de banco em PG não aceitam parâmetros — sanitizamos aqui
  const safe = String(name).replace(/[^a-zA-Z0-9_]/g, '');
  if (!safe) throw new Error('Nome de banco inválido');
  const client = new pg.Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: 'postgres',
    connectionTimeoutMillis: 5000,
    ...PG_CONN_DEFAULTS,
  });
  try {
    await client.connect();
    // "CREATE DATABASE IF NOT EXISTS" não existe em PG — precisa verificar antes
    const r = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [safe]);
    if (r.rowCount === 0) {
      await client.query(`CREATE DATABASE "${safe}" ENCODING 'UTF8'`);
    }
  } catch (err) {
    throw new Error(pgErrorMessage(err));
  } finally {
    await client.end().catch(() => {});
  }
}

export async function executeSchema(
  cfg: ConnectionConfig,
  database: string,
  sql: string,
  onProgress?: (msg: string, pct: number) => void
): Promise<{ statements: number; failures: Array<{ preview: string; error: string }> }> {
  const client = new pg.Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database,
    connectionTimeoutMillis: 10000,
    ...PG_CONN_DEFAULTS,
  });
  await client.connect();
  try {
    const statements = splitSqlStatements(sql);
    let done = 0;
    const failures: Array<{ preview: string; error: string }> = [];
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      try {
        await client.query(rewriteSql(trimmed));
      } catch (e) {
        const msg = pgErrorMessage(e);
        // Tolera "já existe / duplicated"
        if (!/exists|duplicate|already|existe/i.test(msg)) {
          const preview = trimmed.replace(/\s+/g, ' ').slice(0, 120);
          failures.push({ preview, error: msg });
          console.warn('[executeSchema] statement falhou:', preview, '→', msg);
        }
      }
      done++;
      onProgress?.(`Aplicando estrutura ${done}/${statements.length}`, Math.round((done / statements.length) * 100));
    }
    if (failures.length > 0) {
      console.warn(`[executeSchema] ${failures.length} statement(s) falharam. Verifique os logs acima.`);
    }
    return { statements: done, failures };
  } finally {
    await client.end();
  }
}

function splitSqlStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inSingle = false;
  let inDouble = false;
  let inDollar = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    const next = sql[i + 1];
    const prev = sql[i - 1];

    // Comentário de linha `--` (só reconhece fora de string). Consome até \n
    // sem tocar em nenhum outro estado — se não fizesse isso, um `;` ou aspas
    // dentro do comentário quebrariam o parser.
    if (inLineComment) {
      buf += c;
      if (c === '\n') inLineComment = false;
      continue;
    }
    // Comentário de bloco /* ... */
    if (inBlockComment) {
      buf += c;
      if (c === '*' && next === '/') {
        buf += '/';
        i++;
        inBlockComment = false;
      }
      continue;
    }
    if (!inSingle && !inDouble && !inDollar) {
      if (c === '-' && next === '-') {
        buf += '--';
        i++;
        inLineComment = true;
        continue;
      }
      if (c === '/' && next === '*') {
        buf += '/*';
        i++;
        inBlockComment = true;
        continue;
      }
    }

    // PG dollar-quoted strings ($$...$$) — implementação básica
    if (c === '$' && next === '$') inDollar = !inDollar;
    if (c === "'" && prev !== '\\' && !inDouble && !inDollar) inSingle = !inSingle;
    else if (c === '"' && prev !== '\\' && !inSingle && !inDollar) inDouble = !inDouble;
    if (c === ';' && !inSingle && !inDouble && !inDollar) {
      out.push(buf);
      buf = '';
      continue;
    }
    buf += c;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

export async function getPool(): Promise<CompatPool> {
  if (pgPool) return wrapPool(pgPool);
  const cfg = getConfig();
  const host = cfg.get('db.host');
  const database = cfg.get('db.database');
  if (!host || !database) throw new Error('Banco de dados não configurado');
  pgPool = new pg.Pool({
    host,
    port: cfg.get('db.port') ?? 5432,
    user: cfg.get('db.user') ?? 'postgres',
    password: cfg.get('db.password') ?? '',
    database,
    max: 10,
    idleTimeoutMillis: 30_000,
    ...PG_CONN_DEFAULTS,
  });
  return wrapPool(pgPool);
}

export async function closePool(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
}

// Backward-compat exports (alguns arquivos importam Pool como tipo)
export type Pool = CompatPool;
export type Connection = CompatConnection;
