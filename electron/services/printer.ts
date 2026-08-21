import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer';
import { getConfig } from './config';

export type PrinterConfig = {
  type: 'usb' | 'network' | 'serial';
  interface: string;
  width?: 48 | 32;
  drawerEnabled?: boolean;
};

function buildPrinter(cfg: PrinterConfig): ThermalPrinter {
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: cfg.interface,
    characterSet: CharacterSet.PC860_PORTUGUESE,
    removeSpecialCharacters: false,
    lineCharacter: '-',
    width: cfg.width ?? 48,
    options: { timeout: 5000 },
  });
}

export async function testPrint(cfg: PrinterConfig, companyName = 'Bipa PDV'): Promise<{ ok: boolean; error?: string }> {
  try {
    const printer = buildPrinter(cfg);
    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) return { ok: false, error: 'Impressora não conectada' };

    printer.alignCenter();
    printer.setTextDoubleHeight();
    printer.bold(true);
    printer.println(companyName);
    printer.bold(false);
    printer.setTextNormal();
    printer.println('TESTE DE IMPRESSÃO');
    printer.drawLine();
    printer.alignLeft();
    printer.println('Impressora configurada com sucesso.');
    printer.println(`Data: ${new Date().toLocaleString('pt-BR')}`);
    printer.drawLine();
    printer.alignCenter();
    printer.println('Bipa PDV');
    printer.cut();
    await printer.execute();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function openDrawer(): Promise<{ ok: boolean; error?: string }> {
  const cfg = getConfig();
  if (!cfg.get('printer.drawerEnabled')) return { ok: false, error: 'Gaveta não habilitada' };
  const type = cfg.get('printer.type');
  const iface = cfg.get('printer.interface');
  if (!type || !iface) return { ok: false, error: 'Impressora não configurada' };
  try {
    const printer = buildPrinter({ type, interface: iface });
    printer.openCashDrawer();
    await printer.execute();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function listUsbPrinters(): Promise<string[]> {
  // On Windows, thermal printers show up as system printers; the caller can also enter the name manually.
  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const exec = promisify(execFile);
    if (process.platform === 'win32') {
      const { stdout } = await exec('powershell', ['-Command', 'Get-Printer | Select-Object -ExpandProperty Name'], { timeout: 5000 });
      return stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
}
