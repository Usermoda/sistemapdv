import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import net from 'node:net';
import { isBundledInstalled } from './mysqlInstaller';

const exec = promisify(execFile);

export type DetectionResult = {
  installed: boolean;
  running: boolean;
  port: number;
  version?: string;
  serviceName?: string;
  bundled: boolean;
  canAutoInstall: boolean;
  hint?: string;
};

export async function detectMysql(port = 3306): Promise<DetectionResult> {
  const result: DetectionResult = {
    installed: false,
    running: false,
    port,
    bundled: false,
    canAutoInstall: process.platform === 'win32',
  };

  result.running = await isPortOpen('127.0.0.1', port);

  if (isBundledInstalled()) {
    result.installed = true;
    result.bundled = true;
    result.version = 'MariaDB (portable)';
  }

  if (process.platform === 'win32' && !result.bundled) {
    const serviceName = await findWindowsMysqlService();
    if (serviceName) {
      result.installed = true;
      result.serviceName = serviceName;
    }
  }

  if (!result.installed) {
    try {
      const { stdout } = await exec('mysql', ['--version'], { timeout: 3000 });
      result.installed = true;
      const m = stdout.match(/Ver\s+([\d.]+)/i);
      if (m) result.version = m[1];
    } catch {
      // ignore
    }
  }

  if (!result.installed) {
    result.hint = result.canAutoInstall
      ? 'MySQL/MariaDB não encontrado. Você pode instalar automaticamente com um clique.'
      : 'MySQL não foi encontrado. Instale MySQL Community Server 8.0+ ou MariaDB 10.6+ antes de continuar.';
  } else if (!result.running) {
    result.hint = `MySQL instalado mas não está em execução na porta ${port}.`;
  }

  return result;
}

async function isPortOpen(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
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

async function findWindowsMysqlService(): Promise<string | null> {
  try {
    const { stdout } = await exec('sc', ['query', 'type=', 'service', 'state=', 'all'], { timeout: 5000 });
    const lines = stdout.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/SERVICE_NAME:\s*(\S*mysql\S*|\S*mariadb\S*)/i);
      if (m) return m[1];
    }
  } catch {
    // ignore
  }
  return null;
}

export async function tryStartWindowsService(name: string): Promise<{ ok: boolean; error?: string }> {
  if (process.platform !== 'win32') return { ok: false, error: 'Somente Windows' };
  try {
    await exec('net', ['start', name], { timeout: 15000 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
