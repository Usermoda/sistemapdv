import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import { getConfig } from '../services/config';
import { runBackup, listBackups, restoreBackup, deleteBackup, getBackupDir, refreshBackupScheduler } from '../services/backup';

type BackupSettings = {
  enabled: boolean;
  hour: number;
  minute: number;
  keepDays: number;
  customPath: string;
  lastRun: string | null;
};

export function registerBackupHandlers(): void {
  ipcMain.handle('backup:get-settings', async (): Promise<BackupSettings> => {
    const c = getConfig();
    return {
      enabled: !!c.get('backup.enabled'),
      hour: c.get('backup.hour') ?? 3,
      minute: c.get('backup.minute') ?? 0,
      keepDays: c.get('backup.keepDays') ?? 30,
      customPath: c.get('backup.customPath') ?? '',
      lastRun: c.get('backup.lastRun') ?? null,
    };
  });

  ipcMain.handle('backup:save-settings', async (_e, s: BackupSettings) => {
    const c = getConfig();
    c.set('backup.enabled', s.enabled);
    c.set('backup.hour', s.hour);
    c.set('backup.minute', s.minute);
    c.set('backup.keepDays', s.keepDays);
    c.set('backup.customPath', s.customPath);
    refreshBackupScheduler();
    return { ok: true };
  });

  ipcMain.handle('backup:run-now', async () => runBackup());
  ipcMain.handle('backup:list', async () => listBackups());
  ipcMain.handle('backup:restore', async (_e, backupPath: string) => restoreBackup(backupPath));
  ipcMain.handle('backup:delete', async (_e, name: string) => {
    deleteBackup(name);
    return { ok: true };
  });
  ipcMain.handle('backup:open-folder', async () => {
    await shell.openPath(getBackupDir());
    return { ok: true };
  });
  ipcMain.handle('backup:choose-folder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });
}
