import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater, type UpdateInfo, type ProgressInfo } from 'electron-updater';

/**
 * Estado que emitimos pro renderer via IPC "updater:state".
 * Um único canal de eventos para o front acompanhar todo o ciclo.
 */
type UpdaterState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'available'; info: { version: string; releaseNotes?: string | null; releaseDate?: string } }
  | { phase: 'not-available'; currentVersion: string; latestVersion: string }
  | { phase: 'downloading'; percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { phase: 'downloaded'; info: { version: string; releaseNotes?: string | null; releaseDate?: string } }
  | { phase: 'error'; message: string };

let currentState: UpdaterState = { phase: 'idle' };

function broadcast(state: UpdaterState) {
  currentState = state;
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('updater:state', state);
  }
}

/**
 * Inicializa o autoUpdater e registra os handlers IPC de controle.
 * Chame uma vez após `app.whenReady()`.
 */
export function initUpdater(): void {
  // Download automático + aplicação silenciosa ao fechar o app.
  // O usuário só vê um toast informativo "Atualização pronta" quando
  // termina o download — nenhuma ação é obrigatória.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;

  // Logging pro console — útil ao rodar via terminal
  autoUpdater.logger = {
    info: (m: unknown) => console.log('[updater]', m),
    warn: (m: unknown) => console.warn('[updater]', m),
    error: (m: unknown) => console.error('[updater]', m),
    debug: () => undefined,
  };

  autoUpdater.on('checking-for-update', () => broadcast({ phase: 'checking' }));

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    broadcast({
      phase: 'available',
      info: {
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
        releaseDate: info.releaseDate,
      },
    });
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    broadcast({
      phase: 'not-available',
      currentVersion: app.getVersion(),
      latestVersion: info.version,
    });
  });

  autoUpdater.on('download-progress', (p: ProgressInfo) => {
    broadcast({
      phase: 'downloading',
      percent: p.percent,
      bytesPerSecond: p.bytesPerSecond,
      transferred: p.transferred,
      total: p.total,
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    broadcast({
      phase: 'downloaded',
      info: {
        version: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
        releaseDate: info.releaseDate,
      },
    });
  });

  autoUpdater.on('error', (err: Error) => {
    broadcast({ phase: 'error', message: err.message });
  });

  ipcMain.handle('updater:get-state', () => ({
    state: currentState,
    currentVersion: app.getVersion(),
    isPackaged: app.isPackaged,
  }));

  // Só faz sentido em produção — em dev o electron-updater falha porque não
  // há binário empacotado. O front pode chamar sem medo, aqui filtramos.
  ipcMain.handle('updater:check', async () => {
    if (!app.isPackaged) return { ok: false, error: 'Updates só funcionam no app instalado (produção)' };
    try {
      const r = await autoUpdater.checkForUpdates();
      return { ok: true, updateInfo: r?.updateInfo ?? null };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('updater:download', async () => {
    if (!app.isPackaged) return { ok: false, error: 'Somente em produção' };
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

  ipcMain.handle('updater:install', () => {
    if (!app.isPackaged) return { ok: false, error: 'Somente em produção' };
    // Fecha o app e aplica o update. `isSilent = false` mostra a tela do NSIS
    // para o usuário acompanhar; `isForceRunAfter = true` reabre o app.
    autoUpdater.quitAndInstall(false, true);
    return { ok: true };
  });

  // Check silenciosa no boot (10s de delay pra não competir com a inicialização)
  setTimeout(() => {
    if (app.isPackaged) {
      autoUpdater.checkForUpdates().catch((e) => console.warn('[updater] boot check falhou:', e));
    }
  }, 10_000);
}
