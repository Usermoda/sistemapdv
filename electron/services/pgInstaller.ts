import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import EmbeddedPostgres from 'embedded-postgres';
import { getConfig } from './config';

/**
 * Instalador do PostgreSQL portable via biblioteca `embedded-postgres`.
 *
 * A biblioteca baixa binários oficiais do PG na primeira execução, roda
 * `initdb` pra criar o cluster e sobe o servidor num processo separado.
 * Reproduz a mesma UX do `mysqlInstaller.ts` (download → extract → init → start),
 * então o wizard pode chamar as mesmas funções trocando só o import.
 */

const PG_DEFAULT_PORT = 5432;
const PG_USER = 'postgres';
// Senha padrão do bundle. Em produção o usuário pode ajustar em Configurações.
const PG_PASSWORD = 'bipa-local';

let instance: EmbeddedPostgres | null = null;
let running = false;

function bundlePaths() {
  const base = path.join(app.getPath('userData'), 'postgres');
  return {
    base,
    dataDir: path.join(base, 'data'),
  };
}

export function isBundledInstalled(): boolean {
  const p = bundlePaths();
  // O initdb popula o dataDir com PG_VERSION quando o cluster está pronto
  return fs.existsSync(path.join(p.dataDir, 'PG_VERSION'));
}

export function isBundledRunning(): boolean {
  return running;
}

export type ProgressPhase = 'download' | 'extract' | 'init' | 'start';
export type ProgressUpdate = { phase: ProgressPhase; msg: string; pct: number };

async function isPortOpen(host: string, port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

async function findFreePort(start = PG_DEFAULT_PORT, max = 5450): Promise<number> {
  for (let p = start; p <= max; p++) {
    if (!(await isPortOpen('127.0.0.1', p, 400))) return p;
  }
  throw new Error(`Nenhuma porta livre entre ${start} e ${max}`);
}

function makeInstance(port: number): EmbeddedPostgres {
  const p = bundlePaths();
  return new EmbeddedPostgres({
    databaseDir: p.dataDir,
    user: PG_USER,
    password: PG_PASSWORD,
    port,
    persistent: true,
    // scram-sha-256 é o padrão moderno do PG (>=13). password é o legado, mais
    // permissivo pra multi-terminal em LAN. Usamos password aqui por
    // compatibilidade com clients antigos.
    authMethod: 'password',
  });
}

/**
 * Instala o PG portable: baixa binários, cria cluster e sobe.
 * Idempotente — se já instalado, só levanta o servidor.
 */
export async function installBundledPostgres(
  onProgress: (u: ProgressUpdate) => void
): Promise<{ ok: boolean; port?: number; error?: string }> {
  try {
    if (isBundledRunning()) {
      return { ok: true, port: getConfig().get('db.port') ?? PG_DEFAULT_PORT };
    }

    const port = await findFreePort();

    if (!isBundledInstalled()) {
      onProgress({ phase: 'download', msg: 'Baixando PostgreSQL portátil...', pct: 5 });
      instance = makeInstance(port);
      // A biblioteca baixa os binários automaticamente na primeira chamada
      // e roda initdb. Não emite eventos granulares — simulamos progresso.
      onProgress({ phase: 'extract', msg: 'Preparando binários...', pct: 40 });
      onProgress({ phase: 'init', msg: 'Inicializando o cluster de dados...', pct: 60 });
      await instance.initialise();
      onProgress({ phase: 'start', msg: 'Iniciando PostgreSQL...', pct: 85 });
    } else {
      instance = makeInstance(port);
      onProgress({ phase: 'start', msg: 'Iniciando PostgreSQL...', pct: 60 });
    }

    await instance.start();
    running = true;

    // Persiste a config
    const cfg = getConfig();
    cfg.set('db.host', '127.0.0.1');
    cfg.set('db.port', port);
    cfg.set('db.user', PG_USER);
    cfg.set('db.password', PG_PASSWORD);
    cfg.set('db.bundled', true);

    onProgress({ phase: 'start', msg: 'PostgreSQL pronto', pct: 100 });
    return { ok: true, port };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Sobe o PG portable já instalado (usado no boot do app).
 */
export async function startBundledPostgres(port?: number): Promise<{ ok: boolean; error?: string }> {
  try {
    if (running && instance) return { ok: true };
    if (!isBundledInstalled()) return { ok: false, error: 'PostgreSQL bundled não instalado' };
    const p = port ?? getConfig().get('db.port') ?? PG_DEFAULT_PORT;
    instance = makeInstance(p);
    await instance.start();
    running = true;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Para o processo do PG (chamado no `before-quit` do Electron).
 */
export async function stopBundledPostgres(): Promise<void> {
  try {
    if (instance && running) {
      await instance.stop();
      running = false;
      instance = null;
    }
  } catch {
    // Ignora — vamos fechar o app de qualquer jeito
  }
}

/**
 * No boot, sobe o PG se estiver configurado e instalado.
 */
export async function autoStartIfConfigured(): Promise<void> {
  const cfg = getConfig();
  if (!cfg.get('db.bundled')) return;
  if (!isBundledInstalled()) return;
  const port = cfg.get('db.port') ?? PG_DEFAULT_PORT;
  await startBundledPostgres(port);
}
