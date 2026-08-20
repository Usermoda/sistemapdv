import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn, ChildProcess, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getConfig } from './config';

const exec = promisify(execFile);

const MARIADB_VERSION = '10.11.10';
const MARIADB_URL = `https://archive.mariadb.org/mariadb-${MARIADB_VERSION}/winx64-packages/mariadb-${MARIADB_VERSION}-winx64.zip`;

let mysqldProcess: ChildProcess | null = null;

function bundlePaths() {
  const base = path.join(app.getPath('userData'), 'mariadb');
  const installDir = path.join(base, `mariadb-${MARIADB_VERSION}-winx64`);
  const binDir = path.join(installDir, 'bin');
  return {
    base,
    zip: path.join(base, 'mariadb.zip'),
    installDir,
    dataDir: path.join(base, 'data'),
    binDir,
    mysqld: path.join(binDir, 'mysqld.exe'),
    mysql: path.join(binDir, 'mysql.exe'),
    installDb: path.join(binDir, 'mysql_install_db.exe'),
    mariadbInstallDb: path.join(binDir, 'mariadb-install-db.exe'),
    // MariaDB ships a template data directory inside the extracted archive
    templateDataDir: path.join(installDir, 'data'),
  };
}

export function isBundledInstalled(): boolean {
  const p = bundlePaths();
  return fs.existsSync(p.mysqld) && fs.existsSync(path.join(p.dataDir, 'mysql'));
}

export function isBundledRunning(): boolean {
  return mysqldProcess !== null && !mysqldProcess.killed;
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

async function findFreePort(start = 3306, max = 3320): Promise<number> {
  for (let p = start; p <= max; p++) {
    if (!(await isPortOpen('127.0.0.1', p, 400))) return p;
  }
  throw new Error(`Nenhuma porta livre entre ${start} e ${max}`);
}

async function downloadFile(
  url: string,
  dest: string,
  onProgress: (pct: number, downloaded: number, total: number) => void
): Promise<void> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`Download falhou (HTTP ${res.status})`);
  const total = Number(res.headers.get('content-length') || 0);

  const out = fs.createWriteStream(dest);
  const reader = res.body.getReader();
  let downloaded = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      out.write(Buffer.from(value));
      downloaded += value.length;
      if (total > 0) onProgress(Math.round((downloaded / total) * 100), downloaded, total);
    }
  } finally {
    out.end();
  }
  await new Promise<void>((resolve, reject) => {
    out.on('close', () => resolve());
    out.on('error', reject);
  });
}

function copyDirSync(src: string, dst: string): void {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

async function initializeDataDir(p: ReturnType<typeof bundlePaths>): Promise<void> {
  // Clean any partial data dir left by a previous failed attempt
  if (fs.existsSync(p.dataDir)) {
    try {
      fs.rmSync(p.dataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
  fs.mkdirSync(p.dataDir, { recursive: true });

  // Best on MariaDB Windows: copy the template data dir shipped inside the archive.
  // This is atomic-ish, works offline, doesn't require running any child process.
  if (fs.existsSync(p.templateDataDir) && fs.readdirSync(p.templateDataDir).length > 0) {
    copyDirSync(p.templateDataDir, p.dataDir);
    if (fs.existsSync(path.join(p.dataDir, 'mysql'))) return;
  }

  // Fallbacks: try the install helpers (varies by MariaDB build)
  const tryCommand = async (
    binPath: string,
    args: string[]
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!fs.existsSync(binPath)) return { ok: false, error: `${path.basename(binPath)} não encontrado` };
    try {
      await exec(binPath, args, { timeout: 180000, maxBuffer: 20 * 1024 * 1024 });
      return { ok: true };
    } catch (e) {
      const err = e as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
      return { ok: false, error: err.stderr || err.stdout || err.message };
    }
  };

  const attempts = [
    { bin: p.mariadbInstallDb, args: [`--datadir=${p.dataDir}`, '--password='] },
    { bin: p.installDb, args: [`--datadir=${p.dataDir}`, '--password='] },
    { bin: p.mysqld, args: ['--initialize-insecure', `--datadir=${p.dataDir}`, `--basedir=${p.installDir}`] },
  ];

  let lastError = '';
  for (const attempt of attempts) {
    const res = await tryCommand(attempt.bin, attempt.args);
    if (res.ok && fs.existsSync(path.join(p.dataDir, 'mysql'))) return;
    lastError = res.error ?? lastError;
  }
  throw new Error(`Falha ao inicializar banco de dados: ${lastError || 'nenhum método de inicialização funcionou'}`);
}

export async function installBundledMariaDB(
  onProgress: (u: ProgressUpdate) => void
): Promise<{ ok: boolean; error?: string; port?: number }> {
  const p = bundlePaths();
  try {
    fs.mkdirSync(p.base, { recursive: true });

    if (!fs.existsSync(p.mysqld)) {
      onProgress({ phase: 'download', msg: 'Baixando MariaDB (~90 MB)...', pct: 0 });
      await downloadFile(MARIADB_URL, p.zip, (pct, dl, total) => {
        const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
        onProgress({
          phase: 'download',
          msg: total > 0 ? `Baixando MariaDB (${mb(dl)} / ${mb(total)} MB)` : `Baixando MariaDB (${mb(dl)} MB)`,
          pct,
        });
      });

      onProgress({ phase: 'extract', msg: 'Extraindo arquivos...', pct: 0 });
      await exec(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          `Expand-Archive -LiteralPath '${p.zip}' -DestinationPath '${p.base}' -Force`,
        ],
        { timeout: 600000, maxBuffer: 50 * 1024 * 1024 }
      );
      onProgress({ phase: 'extract', msg: 'Arquivos extraídos', pct: 100 });
      try {
        fs.unlinkSync(p.zip);
      } catch {
        /* ignore */
      }
    }

    if (!fs.existsSync(path.join(p.dataDir, 'mysql'))) {
      onProgress({ phase: 'init', msg: 'Inicializando banco de dados...', pct: 30 });
      await initializeDataDir(p);
      onProgress({ phase: 'init', msg: 'Banco de dados inicializado', pct: 100 });
    }

    // Choose a free port automatically
    onProgress({ phase: 'start', msg: 'Procurando porta livre...', pct: 10 });
    const initialPort = await findFreePort(3306).catch(() => 3306);

    onProgress({ phase: 'start', msg: `Iniciando serviço na porta ${initialPort}...`, pct: 30 });
    const startRes = await startBundledMysql(initialPort);
    if (!startRes.ok) return { ok: false, error: startRes.error };

    const finalPort = startRes.port ?? initialPort;
    const cfg = getConfig();
    cfg.set('db.bundled', true);
    cfg.set('db.bundledVersion', MARIADB_VERSION);
    cfg.set('db.port', finalPort);
    cfg.set('db.host', '127.0.0.1');
    cfg.set('db.user', 'root');
    cfg.set('db.password', '');

    onProgress({ phase: 'start', msg: `MariaDB rodando na porta ${finalPort}`, pct: 100 });
    return { ok: true, port: finalPort };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function tryStartMysqldOnce(port: number): Promise<{ ok: boolean; error?: string; child: ChildProcess | null; stderrTail: string }> {
  const p = bundlePaths();
  const child = spawn(
    p.mysqld,
    [
      `--datadir=${p.dataDir}`,
      `--basedir=${p.installDir}`,
      `--port=${port}`,
      '--bind-address=127.0.0.1',
      '--console',
    ],
    { windowsHide: true, detached: false, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let stderrTail = '';
  let localChild: ChildProcess | null = child;
  child.stderr?.on('data', (chunk: Buffer) => {
    stderrTail = (stderrTail + chunk.toString('utf8')).slice(-6000);
  });
  child.on('exit', () => {
    localChild = null;
  });

  const start = Date.now();
  while (Date.now() - start < 20000) {
    if (await isPortOpen('127.0.0.1', port, 600)) return { ok: true, child, stderrTail };
    if (localChild === null) {
      return { ok: false, error: stderrTail, child: null, stderrTail };
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  // Timeout — kill and report
  try { child.kill(); } catch { /* ignore */ }
  return { ok: false, error: `Timeout aguardando MariaDB iniciar na porta ${port}`, child: null, stderrTail };
}

function stderrIndicatesBindError(stderr: string): boolean {
  return /Bind on TCP\/IP port|10013|10048|Can't start server|Address already in use|already have another server/i.test(stderr);
}

export async function startBundledMysql(port: number): Promise<{ ok: boolean; error?: string; port?: number }> {
  const p = bundlePaths();
  if (!fs.existsSync(p.mysqld)) return { ok: false, error: 'MariaDB bundled não instalado' };
  if (isBundledRunning()) return { ok: true, port };

  // Try up to 15 ports starting from the requested one, skipping bind errors
  const candidates: number[] = [];
  candidates.push(port);
  // Common alternatives + sequential fallbacks
  const fallbacks = [3307, 3308, 3309, 3310, 3316, 3336, 3366, 3406, 3506, 33060, 33306, 8306, 13306];
  for (const c of fallbacks) if (!candidates.includes(c)) candidates.push(c);

  let lastError = '';
  for (const tryPort of candidates) {
    // Skip if something is already listening (only if it's not our previous instance)
    // We accept a listening port here since findFreePort already selected initial one
    const res = await tryStartMysqldOnce(tryPort);
    if (res.ok && res.child) {
      mysqldProcess = res.child;
      mysqldProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          console.error(`mysqld exited with code ${code}. Tail:\n${res.stderrTail}`);
        }
        mysqldProcess = null;
      });
      // Persist chosen port in config so next boot uses it
      const { getConfig } = await import('./config');
      getConfig().set('db.port', tryPort);
      return { ok: true, port: tryPort };
    }
    lastError = res.error ?? '';
    // Only try next port for known bind/access errors — other errors (missing datadir, etc.) should abort
    if (!stderrIndicatesBindError(lastError)) {
      return { ok: false, error: `mysqld falhou ao iniciar: ${lastError.split('\n').slice(-4).join(' ').trim()}` };
    }
    console.warn(`Port ${tryPort} blocked (Windows reserved or in use), trying next...`);
  }

  return {
    ok: false,
    error:
      `Não foi possível abrir nenhuma porta para o MariaDB. O Windows pode ter reservado essas portas ` +
      `(Hyper-V/WSL). Execute como administrador: netsh int ipv4 show excludedportrange protocol=tcp — ` +
      `para ver o intervalo bloqueado. Último erro: ${lastError.split('\n').slice(-2).join(' ').trim()}`,
  };
}

export async function stopBundledMysql(): Promise<void> {
  if (!mysqldProcess) return;
  try {
    mysqldProcess.kill();
  } catch {
    // ignore
  }
  mysqldProcess = null;
}

export async function autoStartIfConfigured(): Promise<void> {
  const cfg = getConfig();
  if (cfg.get('db.bundled') && isBundledInstalled()) {
    const port = cfg.get('db.port') ?? 3306;
    await startBundledMysql(port);
  }
}
