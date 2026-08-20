import { ipcMain } from 'electron';
import { listSerialPorts, readScaleOnce, type ScaleProtocol } from '../services/hardware';
import { getConfig } from '../services/config';

export function registerHardwareHandlers(): void {
  ipcMain.handle('hardware:list-serial-ports', async () => listSerialPorts());

  ipcMain.handle('hardware:get-status', async () => {
    const s = getConfig();
    return {
      scaleEnabled: !!s.get('scale.enabled'),
      drawerEnabled: !!s.get('printer.drawerEnabled') && !!s.get('printer.configured'),
      printerConfigured: !!s.get('printer.configured'),
    };
  });

  ipcMain.handle(
    'hardware:test-scale',
    async (_e, args: { port: string; baudRate?: number; protocol?: ScaleProtocol; save?: boolean }) => {
      const res = await readScaleOnce(args.port, args.baudRate ?? 9600, args.protocol ?? 'toledo');
      if (res.ok && args.save) {
        const s = getConfig();
        s.set('scale.enabled', true);
        s.set('scale.port', args.port);
        s.set('scale.baudRate', args.baudRate ?? 9600);
        s.set('scale.protocol', args.protocol ?? 'toledo');
      }
      return res;
    }
  );

  ipcMain.handle('hardware:read-scale', async () => {
    const s = getConfig();
    if (!s.get('scale.enabled')) return { ok: false, error: 'Balança não habilitada' };
    const port = s.get('scale.port');
    if (!port) return { ok: false, error: 'Porta da balança não configurada' };
    return readScaleOnce(port, s.get('scale.baudRate') ?? 9600, (s.get('scale.protocol') ?? 'toledo') as ScaleProtocol);
  });
}
