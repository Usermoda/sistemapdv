import { contextBridge, ipcRenderer } from 'electron';

type Channel =
  | 'app:get-setup-status'
  | 'app:quit'
  | 'db:detect-mysql'
  | 'db:test-connection'
  | 'db:list-databases'
  | 'db:create-database'
  | 'db:install-schema'
  | 'db:query'
  | 'db:save-config'
  | 'setup:save-company'
  | 'setup:get-company'
  | 'setup:complete'
  | 'printer:list'
  | 'printer:save-config'
  | 'printer:get-config'
  | 'printer:test-print'
  | 'printer:open-drawer'
  | 'hardware:list-serial-ports'
  | 'hardware:test-scale'
  | 'hardware:get-status';

const api = {
  invoke: (channel: Channel, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    const wrapped = (_e: unknown, ...args: unknown[]) => listener(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronApi = typeof api;
