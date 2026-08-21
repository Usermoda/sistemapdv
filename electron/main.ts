import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { registerDbHandlers } from './ipc/db';
import { registerSetupHandlers } from './ipc/setup';
import { registerPrinterHandlers } from './ipc/printer';
import { registerHardwareHandlers } from './ipc/hardware';
import { registerPdvHandlers } from './ipc/pdv';
import { registerErpHandlers } from './ipc/erp';
import { registerFiscalHandlers } from './ipc/fiscal';
import { registerAuthHandlers } from './ipc/auth';
import { registerBackupHandlers } from './ipc/backup';
import { registerReportsHandlers } from './ipc/reports';
import { startBackupScheduler } from './services/backup';
import { startFiscalRetryScheduler } from './services/fiscal/emitter';
import { getConfig } from './services/config';
import { autoStartIfConfigured, stopBundledMysql } from './services/mysqlInstaller';
import { runMigrations } from './services/migrations';
import { initUpdater } from './services/updater';

process.env.APP_ROOT = path.join(__dirname, '..');
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // Ícone: em dev, carrega direto do repo; em produção, o electron-builder
  // já embute build/icon.ico e o Windows usa esse.
  const iconPath = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT ?? '', 'build', 'icon.png')
    : path.join(process.env.APP_ROOT ?? '', 'build', 'icon.png');

  mainWindow = new BrowserWindow({
    title: 'Bipa — Sistema PDV',
    icon: iconPath,
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0b0f19',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize();
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

// Windows taskbar grouping / icon: precisa ser setado ANTES de criar a janela.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.grupomaxcenter.sistemapdv');
}

app.whenReady().then(async () => {
  registerDbHandlers();
  registerSetupHandlers();
  registerPrinterHandlers();
  registerHardwareHandlers();
  registerPdvHandlers();
  registerErpHandlers();
  registerFiscalHandlers();
  registerAuthHandlers();
  registerBackupHandlers();
  registerReportsHandlers();

  // Run idempotent migrations if DB is configured. Silently ignores if DB not set up yet.
  void runMigrations().catch((e) => console.error('Migration error:', e));

  // Kick off the backup scheduler (no-op if disabled)
  startBackupScheduler();

  // Retry pending fiscal emissions every 5 min
  startFiscalRetryScheduler();

  void autoStartIfConfigured();

  // Registra o autoUpdater: check silencioso na inicialização + IPCs manuais.
  initUpdater();

  ipcMain.handle('app:get-setup-status', async () => {
    const cfg = getConfig();
    return {
      dbConfigured: !!cfg.get('db.host'),
      companyConfigured: !!cfg.get('company.registered'),
      printerConfigured: !!cfg.get('printer.configured'),
      setupComplete: !!cfg.get('setup.complete'),
      mode: cfg.get('setup.mode') ?? 'server',
    };
  });

  ipcMain.handle('app:set-setup-mode', (_e, mode: 'server' | 'terminal') => {
    getConfig().set('setup.mode', mode);
    return { ok: true };
  });

  ipcMain.handle('app:quit', () => app.quit());

  // Auto-start (registra o app para iniciar com o Windows/macOS).
  ipcMain.handle('app:get-auto-start', () => {
    const s = app.getLoginItemSettings();
    return { enabled: s.openAtLogin };
  });

  ipcMain.handle('app:set-auto-start', (_e, enabled: boolean) => {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      // Em produção, aponta para o próprio executável; em dev, aponta para o Electron+entry (só útil pra teste).
      path: process.execPath,
      args: [],
    });
    getConfig().set('app.autoStart', enabled);
    return { ok: true };
  });

  // Cria atalho no menu iniciar (Windows) — permite ao usuário fixar na barra manualmente.
  ipcMain.handle('app:create-shortcut', () => {
    if (process.platform !== 'win32') return { ok: false, error: 'Somente Windows' };
    try {
      const target = process.execPath;
      // Nome do atalho e caminho do menu iniciar
      const startMenu = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
      const shortcut = path.join(startMenu, 'Bipa PDV.lnk');
      const ok = shell.writeShortcutLink(shortcut, 'create', {
        target,
        args: '',
        description: 'Bipa — Sistema PDV',
        icon: path.join(process.env.APP_ROOT ?? '', 'build', 'icon.ico'),
        iconIndex: 0,
        appUserModelId: 'com.grupomaxcenter.sistemapdv',
      });
      if (!ok) return { ok: false, error: 'Falha ao criar atalho' };
      return { ok: true, path: shortcut };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  // Cria/remove regra de Firewall do Windows para uma porta TCP. Requer admin,
  // então spawna netsh via PowerShell Start-Process -Verb RunAs (dispara UAC).
  ipcMain.handle('system:add-firewall-rule', async (_e, args: { port: number; name?: string }) => {
    if (process.platform !== 'win32') return { ok: false, error: 'Somente Windows' };
    const name = (args.name ?? 'Bipa MariaDB').replace(/["'`]/g, '');
    const port = Number(args.port);
    if (!Number.isFinite(port) || port < 1 || port > 65535) return { ok: false, error: 'Porta inválida' };

    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      // Remove qualquer regra anterior com o mesmo nome (idempotente) e cria a nova.
      const psCmd = `$rules = @( 'advfirewall firewall delete rule name=\\\"${name}\\\"'; 'advfirewall firewall add rule name=\\\"${name}\\\" dir=in action=allow protocol=TCP localport=${port} profile=any' ); foreach ($r in $rules) { Start-Process -Wait -Verb RunAs -WindowStyle Hidden -FilePath netsh.exe -ArgumentList $r }`;
      import('node:child_process').then(({ spawn }) => {
        const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCmd], { windowsHide: true });
        let stderr = '';
        child.stderr?.on('data', (d) => { stderr += d.toString(); });
        child.on('exit', (code) => {
          if (code === 0) resolve({ ok: true });
          else resolve({ ok: false, error: stderr.trim() || `netsh saiu com código ${code}` });
        });
        child.on('error', (e) => resolve({ ok: false, error: e.message }));
      });
    });
  });

  ipcMain.handle('system:remove-firewall-rule', async (_e, args: { name?: string }) => {
    if (process.platform !== 'win32') return { ok: false, error: 'Somente Windows' };
    const name = (args.name ?? 'Bipa MariaDB').replace(/["'`]/g, '');
    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const psCmd = `Start-Process -Wait -Verb RunAs -WindowStyle Hidden -FilePath netsh.exe -ArgumentList 'advfirewall firewall delete rule name=\\\"${name}\\\"'`;
      import('node:child_process').then(({ spawn }) => {
        const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCmd], { windowsHide: true });
        let stderr = '';
        child.stderr?.on('data', (d) => { stderr += d.toString(); });
        child.on('exit', (code) => resolve(code === 0 ? { ok: true } : { ok: false, error: stderr.trim() }));
        child.on('error', (e) => resolve({ ok: false, error: e.message }));
      });
    });
  });

  createWindow();
});

app.on('before-quit', () => {
  void stopBundledMysql();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
  mainWindow = null;
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
