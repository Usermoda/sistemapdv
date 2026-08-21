import { ipcMain } from 'electron';
import { getPool, type ResultSetHeader, type RowDataPacket } from '../services/db';
import { getConfig } from '../services/config';

export type CompanyData = {
  nome_empresa: string;
  cpf_cpnj?: string;
  rg_ie?: string;
  im?: string;
  cep?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  email?: string;
  site?: string;
  telefone?: string;
  fax?: string;
  simbolo_monetario?: string;
  casas_decimais?: number;
  max_desc?: number;
  qtd_turnos?: string;
  qtd_terminal?: number;
};

export function registerSetupHandlers(): void {
  ipcMain.handle('setup:save-company', async (_e, data: CompanyData) => {
    const pool = await getPool();
    const cfg = getConfig();
    const existing = cfg.get('company.id');

    if (existing) {
      const fields = Object.keys(data);
      const setClause = fields.map((f) => `\`${f}\` = ?`).join(', ');
      const values = fields.map((f) => (data as Record<string, unknown>)[f]);
      await pool.query(`UPDATE cad_empresa SET ${setClause} WHERE id = ?`, [...values, existing]);
      return { ok: true, id: existing };
    }

    const fields = Object.keys(data);
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map((f) => (data as Record<string, unknown>)[f]);
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO cad_empresa (${fields.map((f) => `\`${f}\``).join(', ')}) VALUES (${placeholders})`,
      values
    );
    cfg.set('company.id', result.insertId);
    cfg.set('company.registered', true);
    return { ok: true, id: result.insertId };
  });

  ipcMain.handle('setup:get-company', async () => {
    const cfg = getConfig();
    const id = cfg.get('company.id');
    if (!id) return null;
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM cad_empresa WHERE id = ?',
      [id]
    );
    return rows[0] ?? null;
  });

  ipcMain.handle('setup:complete', async () => {
    getConfig().set('setup.complete', true);
    return { ok: true };
  });
}
