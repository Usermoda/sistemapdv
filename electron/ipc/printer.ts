import { ipcMain } from 'electron';
import { getConfig } from '../services/config';
import { listUsbPrinters, openDrawer, testPrint, type PrinterConfig } from '../services/printer';
import { printSaleReceipt, type ReceiptData } from '../services/receipt';

export function registerPrinterHandlers(): void {
  ipcMain.handle('printer:list', async () => listUsbPrinters());

  ipcMain.handle('printer:save-config', async (_e, cfg: PrinterConfig & { name?: string; drawerCode?: number; autoPreview?: 'always' | 'when-no-printer' | 'never' }) => {
    const store = getConfig();
    if (cfg.type !== undefined) store.set('printer.type', cfg.type);
    if (cfg.interface !== undefined) store.set('printer.interface', cfg.interface);
    if (cfg.width !== undefined) store.set('printer.width', cfg.width ?? 48);
    if (cfg.name !== undefined) store.set('printer.name', cfg.name ?? '');
    if (cfg.drawerEnabled !== undefined) store.set('printer.drawerEnabled', !!cfg.drawerEnabled);
    if (cfg.drawerCode !== undefined) store.set('printer.drawerCode', cfg.drawerCode ?? 0);
    if (cfg.autoPreview !== undefined) store.set('printer.autoPreview', cfg.autoPreview);
    // Marks as configured only if an interface was actually provided
    if (cfg.interface) store.set('printer.configured', true);
    return { ok: true };
  });

  ipcMain.handle('printer:get-config', async () => {
    const s = getConfig();
    return {
      type: s.get('printer.type'),
      interface: s.get('printer.interface'),
      name: s.get('printer.name'),
      width: s.get('printer.width'),
      drawerEnabled: s.get('printer.drawerEnabled'),
      drawerCode: s.get('printer.drawerCode'),
      autoPreview: s.get('printer.autoPreview') ?? 'when-no-printer',
      configured: s.get('printer.configured'),
    };
  });

  ipcMain.handle('printer:test-print', async (_e, cfg: PrinterConfig, companyName?: string) => {
    return testPrint(cfg, companyName);
  });

  ipcMain.handle('printer:open-drawer', async () => openDrawer());

  ipcMain.handle('printer:print-receipt', async (_e, data: ReceiptData, openDrawerAfter?: boolean) => {
    return printSaleReceipt(data, !!openDrawerAfter);
  });
}
