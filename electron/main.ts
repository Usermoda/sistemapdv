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

  ipcMain.handle('app:get-setup-status', async () => {
    const cfg = getConfig();
    return {
      dbConfigured: !!cfg.get('db.host'),
      companyConfigured: !!cfg.get('company.registered'),
      printerConfigured: !!cfg.get('printer.configured'),
      setupComplete: !!cfg.get('setup.complete'),
    };
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
