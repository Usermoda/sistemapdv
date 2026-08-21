import { ipcMain, BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { detectMysql, tryStartWindowsService } from '../services/mysqlDetect';
import {
  testConnection,
  listDatabases,
  createDatabase,
  executeSchema,
  getPool,
  closePool,
  type ConnectionConfig,
} from '../services/db';
import { getConfig } from '../services/config';
import { installBundledPostgres, startBundledPostgres, stopBundledPostgres, isBundledInstalled } from '../services/pgInstaller';
import { runMigrations } from '../services/migrations';

export function registerDbHandlers(): void {
  ipcMain.handle('db:detect-mysql', async (_e, port?: number) => {
    const detection = await detectMysql(port ?? 3306);
    if (detection.installed && !detection.running && detection.serviceName) {
      const started = await tryStartWindowsService(detection.serviceName);
      if (started.ok) detection.running = true;
    }
    return detection;
  });

  ipcMain.handle('db:test-connection', async (_e, cfg: ConnectionConfig) => testConnection(cfg));

  ipcMain.handle('db:list-databases', async (_e, cfg: ConnectionConfig) => listDatabases(cfg));

  ipcMain.handle('db:create-database', async (_e, cfg: ConnectionConfig, name: string) => {
    await createDatabase(cfg, name);
    return { ok: true };
  });

  ipcMain.handle('db:install-schema', async (event, cfg: ConnectionConfig, database: string) => {
    const schemaPath = path.join(process.env.APP_ROOT!, 'db', 'schema.sql');
    const sql = await fs.readFile(schemaPath, 'utf8');
    const sender = BrowserWindow.fromWebContents(event.sender);
    const res = await executeSchema(cfg, database, sql, (msg, pct) => {
      sender?.webContents.send('db:install-progress', { msg, pct });
    });
    return res;
  });

  ipcMain.handle(
    'db:save-config',
    async (_e, cfg: ConnectionConfig & { database: string }) => {
      const store = getConfig();
      store.set('db.host', cfg.host);
      store.set('db.port', cfg.port);
      store.set('db.user', cfg.user);
      store.set('db.password', cfg.password);
      store.set('db.database', cfg.database);
      await closePool();
      // eagerly test
      await getPool();
      // ensure schema extensions
      try { await runMigrations(); } catch (e) { console.error('Migrations failed:', e); }
      return { ok: true };
    }
  );

  ipcMain.handle('db:query', async (_e, sql: string, params?: unknown[]) => {
    const pool = await getPool();
    const [rows] = await pool.query(sql, params);
    return rows;
  });

  ipcMain.handle('db:install-bundled', async (event) => {
    const sender = BrowserWindow.fromWebContents(event.sender);
    const res = await installBundledPostgres((u) => {
      sender?.webContents.send('db:install-bundled-progress', u);
    });
    return res;
  });

  ipcMain.handle('db:start-bundled', async (_e, port?: number) => {
    if (!isBundledInstalled()) return { ok: false, error: 'PostgreSQL bundled não instalado' };
    return startBundledPostgres(port ?? 5432);
  });

  // Compartilhamento LAN no PostgreSQL exige editar pg_hba.conf e postgresql.conf
  // (listen_addresses='*' e host all all 0.0.0.0/0 md5). Não implementado ainda —
  // por enquanto o usuário pode habilitar manualmente. Handler mantido pra o
  // front continuar chamando sem quebrar.
  ipcMain.handle('db:set-lan-sharing', async (_e, enabled: boolean) => {
    getConfig().set('db.shareOnLan', enabled);
    const lanIps = collectLanIps();
    return {
      ok: true,
      enabled,
      port: getConfig().get('db.port') ?? 5432,
      lanIps,
      note: 'PG: edite pg_hba.conf e postgresql.conf manualmente por enquanto',
    };
  });

  ipcMain.handle('db:get-lan-info', () => {
    const cfg = getConfig();
    return {
      shareOnLan: !!cfg.get('db.shareOnLan'),
      bundled: !!cfg.get('db.bundled'),
      port: cfg.get('db.port') ?? 5432,
      lanIps: collectLanIps(),
    };
  });
}

function collectLanIps(): string[] {
  const out: string[] = [];
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const n of nets ?? []) {
      if (n.family === 'IPv4' && !n.internal) out.push(n.address);
    }
  }
  return out;
}
