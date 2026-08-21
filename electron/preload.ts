import { contextBridge, ipcRenderer } from 'electron';

type Channel =
  | 'app:get-setup-status'
  | 'app:set-setup-mode'
  | 'app:quit'
  | 'app:get-auto-start'
  | 'app:set-auto-start'
  | 'app:create-shortcut'
  | 'system:add-firewall-rule'
  | 'system:remove-firewall-rule'
  | 'updater:get-state'
  | 'updater:check'
  | 'updater:download'
  | 'updater:install'
  | 'db:detect-mysql'
  | 'db:test-connection'
  | 'db:list-databases'
  | 'db:create-database'
  | 'db:install-schema'
  | 'db:query'
  | 'db:save-config'
  | 'db:install-bundled'
  | 'db:start-bundled'
  | 'db:set-lan-sharing'
  | 'db:get-lan-info'
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
