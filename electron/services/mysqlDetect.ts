// Detecta PostgreSQL local (instalado no sistema) ou o bundle portátil do Bipa.
// Se a porta 5432 já responde falando protocolo PG, reconhecemos como instalado
// mesmo sem `psql` no PATH — o usuário pode simplesmente informar as credenciais.

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

/**
 * Tenta um handshake TCP + protocolo PG. Se o servidor responder com um
 * erro de autenticação (senha errada, role inexistente etc.), confirma que
 * é PG. Se der timeout ou protocol mismatch, retorna false.
 */
async function tryPgHandshake(host: string, port: number, timeoutMs = 2500): Promise<boolean> {
  try {
    const pg = await import('pg');
    const client = new pg.Client({
      host,
      port,
      user: 'postgres',
      password: 'bipa-probe-invalid',
      database: 'postgres',
      connectionTimeoutMillis: timeoutMs,
      // Sem UTF8 explícito, o PG do Windows envia msgs em Windows-1252 e vira lixo
      client_encoding: 'UTF8',
    });
    try {
      await client.connect();
      await client.end();
      console.log('[pg-detect] handshake: connected (auth passed)');
      return true;
    } catch (e) {
      const err = e as Error & { code?: string };
      const msg = (err.message ?? '').toLowerCase();
      console.log('[pg-detect] handshake error code:', err.code, 'message:', err.message);
      // Erros que confirmam que é PG do outro lado. Cobrimos mensagens em
      // inglês/português/espanhol e os códigos SQLSTATE do PG:
      //   28P01 invalid_password, 28000 invalid_authorization_specification,
      //   3D000 invalid_catalog_name, 3F000 invalid_schema_name.
      if (err.code && /^(28P01|28000|3D000|3F000|08P01)$/.test(err.code)) {
        console.log('[pg-detect] handshake: identified by SQLSTATE');
        return true;
      }
      if (
        /password|autentic|autenticac|senha|role|usuário|usuario|user "?.+"? does not exist|pg_hba|database "?.+"? does not exist|banco de dados|scram|md5|sasl/i.test(msg)
      ) {
        console.log('[pg-detect] handshake: identified by message');
        return true;
      }
      return false;
    }
  } catch (e) {
    console.log('[pg-detect] handshake outer error:', (e as Error).message);
    return false;
  }
}

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

  // Se a porta está ocupada, testa se é PG via handshake
  if (!result.installed && result.running) {
    if (await tryPgHandshake('127.0.0.1', port)) {
      result.installed = true;
      result.version = 'PostgreSQL (sistema)';
    }
  }

  // Fallback: procura psql no PATH (útil se o servidor não estiver rodando)
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
  } else if (result.version === 'PostgreSQL (sistema)') {
    result.hint = 'PostgreSQL detectado. Informe suas credenciais abaixo em vez de instalar o portátil.';
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
