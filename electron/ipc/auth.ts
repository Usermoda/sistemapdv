import { ipcMain } from 'electron';
import { login, logout, getSession, listUsers, listProfiles, saveUser, changePassword, saveProfile, deleteProfile } from '../services/auth';

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:login', async (_e, args: { login: string; password: string }) => {
    const session = await login(args.login, args.password);
    if (!session) return { ok: false, error: 'Usuário ou senha inválidos' };
    return { ok: true, session };
  });

  ipcMain.handle('auth:logout', async () => {
    logout();
    return { ok: true };
  });

  ipcMain.handle('auth:current', async () => getSession());

  ipcMain.handle('auth:list-users', async () => listUsers());
  ipcMain.handle('auth:list-profiles', async () => listProfiles());
  ipcMain.handle('auth:save-user', async (_e, data: { id?: number; login: string; id_perfil: number; senha?: string; inativo?: number }) =>
    saveUser(data)
  );
  ipcMain.handle('auth:change-password', async (_e, args: { userId: number; newPassword: string }) => {
    await changePassword(args.userId, args.newPassword);
    return { ok: true };
  });
  ipcMain.handle('auth:save-profile', async (_e, data: { id_perfil?: number; nome_perfil: string; menu_options?: string }) =>
    saveProfile(data)
  );
  ipcMain.handle('auth:delete-profile', async (_e, id_perfil: number) => deleteProfile(id_perfil));
}
