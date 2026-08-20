import { SerialPort } from 'serialport';

export async function listSerialPorts(): Promise<Array<{ path: string; manufacturer?: string; friendlyName?: string }>> {
  try {
    const ports = await SerialPort.list();
    return ports.map((p) => ({
      path: p.path,
      manufacturer: p.manufacturer,
      friendlyName: (p as unknown as { friendlyName?: string }).friendlyName,
    }));
  } catch {
    return [];
  }
}

export type ScaleProtocol = 'toledo' | 'filizola' | 'urano' | 'generic';

export async function readScaleOnce(
  path: string,
  baudRate = 9600,
  protocol: ScaleProtocol = 'toledo',
  timeoutMs = 3000
): Promise<{ ok: boolean; weight?: number; raw?: string; error?: string }> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r: { ok: boolean; weight?: number; raw?: string; error?: string }) => {
      if (done) return;
      done = true;
      try {
        port.close();
      } catch {
        // ignore
      }
      resolve(r);
    };

    const port = new SerialPort({ path, baudRate, autoOpen: false });
    port.open((err) => {
      if (err) return finish({ ok: false, error: err.message });
      // Some scales require an ENQ (0x05) to respond
      port.write(Buffer.from([0x05]));
    });

    let buffer = '';
    port.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('ascii');
      const weight = parseScaleFrame(buffer, protocol);
      if (weight !== null) finish({ ok: true, weight, raw: buffer });
    });

    port.on('error', (err) => finish({ ok: false, error: err.message }));

    setTimeout(() => finish({ ok: false, error: 'Timeout — sem resposta da balança' }), timeoutMs);
  });
}

function parseScaleFrame(buf: string, protocol: ScaleProtocol): number | null {
  // Toledo prt: STX 5 dígitos ETX  -> 05123 = 5,123kg
  if (protocol === 'toledo') {
    const m = buf.match(/\x02(\d{5,6})\x03/);
    if (m) return parseInt(m[1], 10) / 1000;
  }
  // Filizola: <peso em kg>\r\n
  if (protocol === 'filizola' || protocol === 'urano' || protocol === 'generic') {
    const m = buf.match(/(\d{1,3}[,.]?\d{0,3})/);
    if (m) return parseFloat(m[1].replace(',', '.'));
  }
  return null;
}
