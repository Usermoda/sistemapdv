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
import { installBundledMariaDB, startBundledMysql, stopBundledMysql, isBundledInstalled } from '../services/mysqlInstaller';
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
    const res = await installBundledMariaDB((u) => {
      sender?.webContents.send('db:install-bundled-progress', u);
    });
    return res;
  });

  ipcMain.handle('db:start-bundled', async (_e, port?: number) => {
    if (!isBundledInstalled()) return { ok: false, error: 'MariaDB bundled não instalado' };
    return startBundledMysql(port ?? 3306);
  });

  // Habilita/desabilita compartilhamento do MariaDB portable na rede local.
  // Fluxo: grava a flag, roda GRANT root@%, para/inicia o mysqld com novo bind.
  // Retorna os IPs LAN da máquina para o usuário informar aos terminais.
  ipcMain.handle('db:set-lan-sharing', async (_e, enabled: boolean) => {
    const cfg = getConfig();
    const prev = !!cfg.get('db.shareOnLan');
    cfg.set('db.shareOnLan', enabled);

    // Só faz sentido restart+GRANT se estamos usando o MariaDB portable
    const bundled = !!cfg.get('db.bundled');
    if (bundled && enabled) {
      try {
        // GRANT antes de restart — precisa de conexão ativa.
        // Não usa CREATE USER IF NOT EXISTS (MariaDB < 10.1.3 não suporta).
        // Faz CREATE e engole o erro caso o usuário já exista.
        const pool = await getPool();
        try {
          await pool.query("CREATE USER 'root'@'%' IDENTIFIED BY ''");
        } catch (e) {
          const msg = (e as Error).message ?? '';
          // 1396 = ER_CANNOT_USER (usuário já existe / operação já feita)
          if (!/1396|already exists|Operation CREATE USER failed/i.test(msg)) throw e;
        }
        await pool.query("GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION");
        await pool.query('FLUSH PRIVILEGES');
        await closePool();
      } catch (e) {
        return { ok: false, error: `GRANT falhou: ${(e as Error).message}` };
      }
    }

    if (bundled && prev !== enabled) {
      // Reinicia o servidor com o novo bind-address
      try {
        await stopBundledMysql();
        const port = cfg.get('db.port') ?? 3306;
        const r = await startBundledMysql(port);
        if (!r.ok) return { ok: false, error: `Falha ao reiniciar: ${r.error}` };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    }

    // Coleta IPs LAN da máquina
    const lanIps: string[] = [];
    for (const nets of Object.values(os.networkInterfaces())) {
      for (const n of nets ?? []) {
        if (n.family === 'IPv4' && !n.internal) lanIps.push(n.address);
      }
    }

    return { ok: true, enabled, port: cfg.get('db.port') ?? 3306, lanIps };
  });

  ipcMain.handle('db:get-lan-info', () => {
    const cfg = getConfig();
    const lanIps: string[] = [];
    for (const nets of Object.values(os.networkInterfaces())) {
      for (const n of nets ?? []) {
        if (n.family === 'IPv4' && !n.internal) lanIps.push(n.address);
      }
    }
    return {
      shareOnLan: !!cfg.get('db.shareOnLan'),
      bundled: !!cfg.get('db.bundled'),
      port: cfg.get('db.port') ?? 3306,
      lanIps,
    };
  });
}
