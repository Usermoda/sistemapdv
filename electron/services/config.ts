import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

type ConfigSchema = {
  'db.host'?: string;
  'db.port'?: number;
  'db.user'?: string;
  'db.password'?: string;
  'db.database'?: string;
  'db.bundled'?: boolean;
  'db.bundledVersion'?: string;
  'company.registered'?: boolean;
  'company.id'?: number;
  'printer.configured'?: boolean;
  'printer.type'?: 'usb' | 'network' | 'serial';
  'printer.interface'?: string;
  'printer.name'?: string;
  'printer.width'?: 48 | 32;
  'printer.drawerEnabled'?: boolean;
  'printer.drawerCode'?: number;
  'printer.autoPreview'?: 'always' | 'when-no-printer' | 'never';
  'scale.enabled'?: boolean;
  'scale.port'?: string;
  'scale.baudRate'?: number;
  'scale.protocol'?: 'toledo' | 'filizola' | 'urano' | 'generic';
  'setup.complete'?: boolean;
  'terminal.id'?: string;

  // Backup
  'backup.enabled'?: boolean;
  'backup.hour'?: number; // 0-23
  'backup.minute'?: number;
  'backup.keepDays'?: number;
  'backup.customPath'?: string;
  'backup.lastRun'?: string;

  // Fiscal / NFCe
  'fiscal.enabled'?: boolean;
  'fiscal.provider'?: 'focusnfe' | 'none';
  'fiscal.ambiente'?: 'homologacao' | 'producao';
  'fiscal.uf'?: string;
  'fiscal.serie'?: number;
  'fiscal.proximo_numero'?: number;
  'fiscal.regime_tributario'?: 1 | 2 | 3; // 1=Simples, 2=Simples com sublimite, 3=Regime Normal
  'fiscal.cnae'?: string;
  'fiscal.ncm_padrao'?: string;
  'fiscal.cfop_padrao'?: string;
  'fiscal.cst_csosn_padrao'?: string;
  'fiscal.origem_padrao'?: number;
  // Focus NFe
  'fiscal.focusnfe.token'?: string;
  'fiscal.focusnfe.csc_id'?: string;
  'fiscal.focusnfe.csc_token'?: string;
};

class JsonStore<T extends Record<string, unknown>> {
  private data: T;
  private readonly file: string;

  constructor(fileName: string) {
    const dir = app.getPath('userData');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, `${fileName}.json`);
    this.data = this.load();
  }

  private load(): T {
    try {
      if (fs.existsSync(this.file)) {
        const raw = fs.readFileSync(this.file, 'utf8');
        return JSON.parse(raw) as T;
      }
    } catch {
      // corrupted or unreadable — start fresh
    }
    return {} as T;
  }

  private persist(): void {
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8');
  }

  get<K extends keyof T>(key: K): T[K] | undefined {
    return this.data[key];
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data[key] = value;
    this.persist();
  }

  delete<K extends keyof T>(key: K): void {
    delete this.data[key];
    this.persist();
  }

  clear(): void {
    this.data = {} as T;
    this.persist();
  }
}

let store: JsonStore<ConfigSchema> | null = null;

export function getConfig(): JsonStore<ConfigSchema> {
  if (!store) {
    store = new JsonStore<ConfigSchema>('sistema-pdv-config');
  }
  return store;
}
