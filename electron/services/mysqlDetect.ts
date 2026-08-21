// Renomeado internamente pra "dbDetect" mas mantendo o path do arquivo por
// compat com imports existentes. Detecta PostgreSQL local ou o bundle portátil.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import net from 'node:net';
import { isBundledInstalled } from './pgInstaller';

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

export async function detectMysql(port = 5432): Promise<DetectionResult> {
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
    result.version = 'PostgreSQL (portable)';
  }

  if (!result.installed) {
    try {
      const { stdout } = await exec('psql', ['--version'], { timeout: 3000 });
      result.installed = true;
      const m = stdout.match(/(\d+\.\d+(?:\.\d+)?)/);
      if (m) result.version = m[1];
    } catch {
      // sem psql no PATH — ok, oferecemos o bundle
    }
  }

  if (!result.installed) {
    result.hint = result.canAutoInstall
      ? 'PostgreSQL não encontrado. Você pode instalar automaticamente com um clique.'
      : 'PostgreSQL não foi encontrado. Instale PostgreSQL 15+ antes de continuar.';
  } else if (!result.running) {
    result.hint = `PostgreSQL instalado mas não está em execução na porta ${port}.`;
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

// Não usado com PG, mas mantido pra compat com o import atual do ipc/db.ts
export async function tryStartWindowsService(_name: string): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: 'Não aplicável para PostgreSQL portable' };
}
