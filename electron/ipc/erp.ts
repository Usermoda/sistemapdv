import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import type { RowDataPacket, ResultSetHeader } from '../services/db';
import { getPool } from '../services/db';
import { parseNFeXml, type NFeParsed, type NFeItem } from '../services/nfe';

function buildInsert(table: string, data: Record<string, unknown>): { sql: string; values: unknown[] } {
  const fields = Object.keys(data).filter((k) => data[k] !== undefined);
  const values = fields.map((k) => data[k]);
  const sql = `INSERT INTO \`${table}\` (${fields.map((f) => `\`${f}\``).join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`;
  return { sql, values };
}

function buildUpdate(table: string, data: Record<string, unknown>, id: number): { sql: string; values: unknown[] } {
  const fields = Object.keys(data).filter((k) => data[k] !== undefined && k !== 'id');
  const setClause = fields.map((f) => `\`${f}\` = ?`).join(', ');
  const values = [...fields.map((f) => data[f]), id];
  return { sql: `UPDATE \`${table}\` SET ${setClause} WHERE id = ?`, values };
}

export function registerErpHandlers(): void {
  // ============================================================
  // PRODUTOS
  // ============================================================
  ipcMain.handle('erp:products:list', async (_e, args: { search?: string; limit?: number; offset?: number; showInactive?: boolean } = {}) => {
    const pool = await getPool();
    const limit = Math.min(args.limit ?? 50, 500);
    const offset = args.offset ?? 0;
    const q = (args.search ?? '').trim();
    // Include inf_adicional and unidade so etiquetas can render packaging info
    let sql = `SELECT p.*, t.nome_tipo FROM cad_produtos p LEFT JOIN cad_produtos_tipo t ON t.id = p.id_tipo WHERE 1=1`;
    const params: unknown[] = [];
    if (!args.showInactive) sql += ` AND (p.inativo IS NULL OR p.inativo = 0)`;
    if (q) {
      sql += ` AND (p.cod_barra = ? OR p.nome_produto LIKE ? OR p.id = ?)`;
      params.push(q, `%${q}%`, /^\d+$/.test(q) ? Number(q) : -1);
    }
    sql += ` ORDER BY p.nome_produto ASC LIMIT ${limit} OFFSET ${offset}`;
    const [rows] = await pool.query<RowDataPacket[]>(sql, params);

    const [[count]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM cad_produtos WHERE ${!args.showInactive ? '(inativo IS NULL OR inativo = 0)' : '1=1'}`
    );
    return { rows, total: (count as { total: number }).total };
  });

  ipcMain.handle('erp:products:get', async (_e, id: number) => {
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM cad_produtos WHERE id = ? LIMIT 1', [id]);
    return rows[0] ?? null;
  });

  ipcMain.handle('erp:products:save', async (_e, data: Record<string, unknown>) => {
    const pool = await getPool();
    const id = data.id as number | undefined;
    const cleaned = { ...data };
    delete cleaned.id;
    delete cleaned.nome_tipo;
    if (id) {
      const q = buildUpdate('cad_produtos', cleaned, id);
      await pool.query(q.sql, q.values);
      return { id, ok: true };
    }
    const q = buildInsert('cad_produtos', cleaned);
    const [r] = await pool.query<ResultSetHeader>(q.sql, q.values);
    return { id: r.insertId, ok: true };
  });

  ipcMain.handle('erp:products:toggle-active', async (_e, id: number, inativo: boolean) => {
    const pool = await getPool();
    await pool.query('UPDATE cad_produtos SET inativo = ? WHERE id = ?', [inativo ? 1 : 0, id]);
    return { ok: true };
  });

  // Product categories
  ipcMain.handle('erp:products:categories', async () => {
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id, nome_tipo FROM cad_produtos_tipo ORDER BY nome_tipo ASC');
    return rows;
  });

  ipcMain.handle('erp:products:save-category', async (_e, data: { id?: number; nome_tipo: string }) => {
    const pool = await getPool();
    if (data.id) {
      await pool.query('UPDATE cad_produtos_tipo SET nome_tipo = ? WHERE id = ?', [data.nome_tipo, data.id]);
      return { id: data.id };
    }
    const [r] = await pool.query<ResultSetHeader>('INSERT INTO cad_produtos_tipo (nome_tipo) VALUES (?)', [data.nome_tipo]);
    return { id: r.insertId };
  });

  // Product ⇄ Suppliers linking (many-to-many via cad_produtos_fornecedores)
  ipcMain.handle('erp:products:get-suppliers', async (_e, id_produto: number) => {
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT f.id, f.nome_fornecedor, f.cpf_cnpj, f.contato, f.telefone
       FROM cad_produtos_fornecedores pf
       JOIN cad_fornecedores f ON f.id = pf.id_fornecedor
       WHERE pf.id_produto = ?
       ORDER BY f.nome_fornecedor ASC`,
      [id_produto]
    );
    return rows;
  });

  ipcMain.handle(
    'erp:products:set-suppliers',
    async (_e, args: { id_produto: number; supplier_ids: number[] }) => {
      const pool = await getPool();
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM cad_produtos_fornecedores WHERE id_produto = ?', [args.id_produto]);
        for (const id_forn of args.supplier_ids) {
          await conn.query(
            'INSERT INTO cad_produtos_fornecedores (id_produto, id_fornecedor) VALUES (?, ?)',
            [args.id_produto, id_forn]
          );
        }
        await conn.commit();
        return { ok: true };
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }
  );

  // Nota: cad_produtos_codigos é criada em migrations.ts (idempotente no boot).
  // Se por algum motivo faltar em runtime, a query vai lançar erro claro.
  const ensureCodesTable = async () => undefined;

  ipcMain.handle('erp:products:list-codes', async (_e, id_produto: number) => {
    await ensureCodesTable();
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.id, c.id_produto, c.tipo, c.codigo, c.embalagem, c.fator,
              c.id_fornecedor, f.nome_fornecedor,
              c.util_venda, c.preferencial, c.data_inicio, c.inativo
       FROM cad_produtos_codigos c
       LEFT JOIN cad_fornecedores f ON f.id = c.id_fornecedor
       WHERE c.id_produto = ?
       ORDER BY c.preferencial DESC, c.inativo ASC, c.id ASC`,
      [id_produto]
    );
    return rows;
  });

  ipcMain.handle(
    'erp:products:save-code',
    async (
      _e,
      data: {
        id?: number;
        id_produto: number;
        tipo: string;
        codigo: string;
        embalagem?: string | null;
        fator?: number;
        id_fornecedor?: number | null;
        util_venda?: number;
        preferencial?: number;
        data_inicio?: string | null;
        inativo?: number;
      }
    ) => {
      await ensureCodesTable();
      const pool = await getPool();
      const codigo = (data.codigo ?? '').trim();
      if (!codigo) throw new Error('Informe o código');
      // Prevent duplicates on the same product
      const [dup] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM cad_produtos_codigos WHERE id_produto = ? AND codigo = ? AND id <> ?`,
        [data.id_produto, codigo, data.id ?? 0]
      );
      if (dup.length > 0) throw new Error('Este código já está cadastrado neste produto');
      // If setting preferencial, clear it from others
      if (data.preferencial) {
        await pool.query(
          `UPDATE cad_produtos_codigos SET preferencial = 0 WHERE id_produto = ? AND id <> ?`,
          [data.id_produto, data.id ?? 0]
        );
      }
      if (data.id) {
        await pool.query(
          `UPDATE cad_produtos_codigos
           SET tipo=?, codigo=?, embalagem=?, fator=?, id_fornecedor=?, util_venda=?, preferencial=?, data_inicio=?, inativo=?
           WHERE id=?`,
          [
            data.tipo || 'EAN',
            codigo,
            data.embalagem || null,
            data.fator ?? 1,
            data.id_fornecedor || null,
            data.util_venda ?? 1,
            data.preferencial ?? 0,
            data.data_inicio || null,
            data.inativo ?? 0,
            data.id,
          ]
        );
        return { id: data.id };
      }
      const [r] = await pool.query<ResultSetHeader>(
        `INSERT INTO cad_produtos_codigos
         (id_produto, tipo, codigo, embalagem, fator, id_fornecedor, util_venda, preferencial, data_inicio, inativo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.id_produto,
          data.tipo || 'EAN',
          codigo,
          data.embalagem || null,
          data.fator ?? 1,
          data.id_fornecedor || null,
          data.util_venda ?? 1,
          data.preferencial ?? 0,
          data.data_inicio || null,
          data.inativo ?? 0,
        ]
      );
      return { id: r.insertId };
    }
  );

  ipcMain.handle('erp:products:delete-code', async (_e, id: number) => {
    await ensureCodesTable();
    const pool = await getPool();
    await pool.query('DELETE FROM cad_produtos_codigos WHERE id = ?', [id]);
    return { ok: true };
  });

  // ============================================================
  // CLIENTES
  // ============================================================
  ipcMain.handle('erp:clients:list', async (_e, args: { search?: string; limit?: number; offset?: number; showInactive?: boolean } = {}) => {
    const pool = await getPool();
    const limit = Math.min(args.limit ?? 50, 500);
    const offset = args.offset ?? 0;
    const q = (args.search ?? '').trim();
    let sql = `SELECT * FROM cad_clientes WHERE 1=1`;
    const params: unknown[] = [];
    if (!args.showInactive) sql += ` AND (inativo IS NULL OR inativo = 0)`;
    if (q) {
      sql += ` AND (cod_barra = ? OR nome_cliente LIKE ? OR cpf_cnpj LIKE ? OR telefone LIKE ?)`;
      params.push(q, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    sql += ` ORDER BY nome_cliente ASC LIMIT ${limit} OFFSET ${offset}`;
    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    const [[count]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM cad_clientes WHERE ${!args.showInactive ? '(inativo IS NULL OR inativo = 0)' : '1=1'}`
    );
    return { rows, total: (count as { total: number }).total };
  });

  ipcMain.handle('erp:clients:get', async (_e, id: number) => {
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM cad_clientes WHERE id = ? LIMIT 1', [id]);
    return rows[0] ?? null;
  });

  ipcMain.handle('erp:clients:save', async (_e, data: Record<string, unknown>) => {
    const pool = await getPool();
    const id = data.id as number | undefined;
    const cleaned = { ...data };
    delete cleaned.id;
    if (id) {
      const q = buildUpdate('cad_clientes', cleaned, id);
      await pool.query(q.sql, q.values);
      return { id, ok: true };
    }
    const q = buildInsert('cad_clientes', cleaned);
    const [r] = await pool.query<ResultSetHeader>(q.sql, q.values);
    return { id: r.insertId, ok: true };
  });

  ipcMain.handle('erp:clients:toggle-active', async (_e, id: number, inativo: boolean) => {
    const pool = await getPool();
    await pool.query('UPDATE cad_clientes SET inativo = ? WHERE id = ?', [inativo ? 1 : 0, id]);
    return { ok: true };
  });

  // ============================================================
  // FORNECEDORES
  // ============================================================
  ipcMain.handle('erp:suppliers:list', async (_e, args: { search?: string; limit?: number; offset?: number; showInactive?: boolean } = {}) => {
    const pool = await getPool();
    const limit = Math.min(args.limit ?? 50, 500);
    const offset = args.offset ?? 0;
    const q = (args.search ?? '').trim();
    let sql = `SELECT * FROM cad_fornecedores WHERE 1=1`;
    const params: unknown[] = [];
    if (!args.showInactive) sql += ` AND (inativo IS NULL OR inativo = 0)`;
    if (q) {
      sql += ` AND (nome_fornecedor LIKE ? OR cpf_cnpj LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }
    sql += ` ORDER BY nome_fornecedor ASC LIMIT ${limit} OFFSET ${offset}`;
    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    const [[count]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM cad_fornecedores WHERE ${!args.showInactive ? '(inativo IS NULL OR inativo = 0)' : '1=1'}`
    );
    return { rows, total: (count as { total: number }).total };
  });

  ipcMain.handle('erp:suppliers:save', async (_e, data: Record<string, unknown>) => {
    const pool = await getPool();
    const id = data.id as number | undefined;
    const cleaned = { ...data };
    delete cleaned.id;
    if (id) {
      const q = buildUpdate('cad_fornecedores', cleaned, id);
      await pool.query(q.sql, q.values);
      return { id, ok: true };
    }
    const q = buildInsert('cad_fornecedores', cleaned);
    const [r] = await pool.query<ResultSetHeader>(q.sql, q.values);
    return { id: r.insertId, ok: true };
  });

  // Supplier ⇄ Products linking (many-to-many, same cad_produtos_fornecedores table)
  ipcMain.handle('erp:suppliers:get-products', async (_e, id_fornecedor: number) => {
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.id, p.nome_produto, p.cod_barra, p.unidade, p.vr_venda, p.estoque
       FROM cad_produtos_fornecedores pf
       JOIN cad_produtos p ON p.id = pf.id_produto
       WHERE pf.id_fornecedor = ? AND (p.inativo IS NULL OR p.inativo = 0)
       ORDER BY p.nome_produto ASC`,
      [id_fornecedor]
    );
    return rows;
  });

  ipcMain.handle(
    'erp:suppliers:set-products',
    async (_e, args: { id_fornecedor: number; product_ids: number[] }) => {
      const pool = await getPool();
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM cad_produtos_fornecedores WHERE id_fornecedor = ?', [args.id_fornecedor]);
        for (const id_prod of args.product_ids) {
          await conn.query(
            'INSERT INTO cad_produtos_fornecedores (id_produto, id_fornecedor) VALUES (?, ?)',
            [id_prod, args.id_fornecedor]
          );
        }
        await conn.commit();
        return { ok: true };
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }
  );

  // ============================================================
  // VENDAS (histórico)
  // ============================================================
  ipcMain.handle(
    'erp:sales:list',
    async (
      _e,
      args: { from?: string; to?: string; search?: string; limit?: number; offset?: number } = {}
    ) => {
      const pool = await getPool();
      const limit = Math.min(args.limit ?? 50, 500);
      const offset = args.offset ?? 0;

      // Detect if nfce_emitidas exists to include fiscal status columns
      const [[fiscalCheck]] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'nfce_emitidas'`
      );
      const hasFiscal = (fiscalCheck as { c: number }).c > 0;

      const fiscalCols = hasFiscal
        ? `, (SELECT status FROM nfce_emitidas n WHERE n.id_venda = v.id ORDER BY n.id DESC LIMIT 1) AS nfce_status,
             (SELECT chave_nfe FROM nfce_emitidas n WHERE n.id_venda = v.id ORDER BY n.id DESC LIMIT 1) AS nfce_chave`
        : '';

      let sql = `SELECT v.*, c.nome_cliente${fiscalCols}
                 FROM mv_vendas v LEFT JOIN cad_clientes c ON c.id = v.id_cliente WHERE 1=1`;
      const params: unknown[] = [];
      if (args.from) { sql += ' AND v.data_venda >= ?'; params.push(args.from); }
      if (args.to) { sql += ' AND v.data_venda <= ?'; params.push(args.to); }
      if (args.search) {
        sql += ' AND (v.controle LIKE ? OR c.nome_cliente LIKE ?)';
        params.push(`%${args.search}%`, `%${args.search}%`);
      }
      sql += ` ORDER BY v.data_venda DESC, v.id DESC LIMIT ${limit} OFFSET ${offset}`;
      const [rows] = await pool.query<RowDataPacket[]>(sql, params);
      return rows;
    }
  );

  ipcMain.handle('erp:sales:get', async (_e, id: number) => {
    const pool = await getPool();
    const [header] = await pool.query<RowDataPacket[]>(
      `SELECT v.*, c.nome_cliente, c.cpf_cnpj FROM mv_vendas v LEFT JOIN cad_clientes c ON c.id = v.id_cliente WHERE v.id = ? LIMIT 1`,
      [id]
    );
    if (header.length === 0) return null;
    const control = (header[0] as { controle: string }).controle;
    const [items] = await pool.query<RowDataPacket[]>(
      `SELECT m.*, p.nome_produto, p.unidade FROM mv_vendas_movimento m
       LEFT JOIN cad_produtos p ON p.id = m.id_produto
       WHERE m.controle = ? ORDER BY m.id ASC`,
      [control]
    );
    return { header: header[0], items };
  });

  // ============================================================
  // FORMAS DE PAGAMENTO
  // ============================================================
  ipcMain.handle('erp:payment-methods:list', async () => {
    const pool = await getPool();
    // Include inativo column if the migration has run
    const [[hasInativo]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'cad_modo_lancamento' AND column_name = 'inativo'`
    );
    const inativoCol = (hasInativo as { c: number }).c > 0 ? ', COALESCE(inativo, 0) AS inativo' : ', 0 AS inativo';
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, modo_lancamento, protegido${inativoCol} FROM cad_modo_lancamento ORDER BY id ASC`
    );
    return rows;
  });

  ipcMain.handle('erp:payment-methods:save', async (_e, data: { id?: number; modo_lancamento: string }) => {
    const pool = await getPool();
    if (data.id) {
      await pool.query('UPDATE cad_modo_lancamento SET modo_lancamento = ? WHERE id = ?', [data.modo_lancamento, data.id]);
      return { id: data.id };
    }
    const [r] = await pool.query<ResultSetHeader>('INSERT INTO cad_modo_lancamento (modo_lancamento) VALUES (?)', [data.modo_lancamento]);
    return { id: r.insertId };
  });

  ipcMain.handle('erp:payment-methods:delete', async (_e, id: number) => {
    const pool = await getPool();
    const [[cur]] = await pool.query<RowDataPacket[]>('SELECT protegido FROM cad_modo_lancamento WHERE id = ?', [id]);
    if (cur && (cur as { protegido: string }).protegido === 'X') {
      throw new Error('Esta forma de pagamento é protegida e não pode ser removida');
    }
    await pool.query('DELETE FROM cad_modo_lancamento WHERE id = ?', [id]);
    return { ok: true };
  });

  ipcMain.handle('erp:payment-methods:toggle-active', async (_e, id: number, inativo: boolean) => {
    const pool = await getPool();
    await pool.query('UPDATE cad_modo_lancamento SET inativo = ? WHERE id = ?', [inativo ? 1 : 0, id]);
    return { ok: true };
  });

  // ============================================================
  // PREÇOS / PROMOÇÕES
  // ============================================================
  // cad_produtos_promocao é criada em migrations.ts (idempotente no boot).
  const ensurePromoTable = async () => undefined;

  ipcMain.handle(
    'erp:prices:list',
    async (
      _e,
      args: { search?: string; id_tipo?: number | null; onlyLowMargin?: boolean; limit?: number } = {}
    ) => {
      await ensurePromoTable();
      const pool = await getPool();
      const limit = Math.min(args.limit ?? 200, 1000);
      const q = (args.search ?? '').trim();
      let sql = `SELECT p.id, p.nome_produto, p.cod_barra, p.unidade, p.vr_compra, p.vr_venda, p.vr_venda_2, p.estoque, p.id_tipo, t.nome_tipo,
                        (SELECT pr.vr_promocao FROM cad_produtos_promocao pr
                         WHERE pr.id_produto = p.id AND pr.inativo = 0
                           AND pr.data_inicio <= CURRENT_DATE
                           AND (pr.data_fim IS NULL OR pr.data_fim >= CURRENT_DATE)
                         ORDER BY pr.vr_promocao ASC, pr.quantidade_minima ASC LIMIT 1) AS vr_promocao_ativo,
                        (SELECT pr.quantidade_minima FROM cad_produtos_promocao pr
                         WHERE pr.id_produto = p.id AND pr.inativo = 0
                           AND pr.data_inicio <= CURRENT_DATE
                           AND (pr.data_fim IS NULL OR pr.data_fim >= CURRENT_DATE)
                         ORDER BY pr.vr_promocao ASC, pr.quantidade_minima ASC LIMIT 1) AS promocao_qty_min,
                        (SELECT pr.data_fim FROM cad_produtos_promocao pr
                         WHERE pr.id_produto = p.id AND pr.inativo = 0
                           AND pr.data_inicio <= CURRENT_DATE
                           AND (pr.data_fim IS NULL OR pr.data_fim >= CURRENT_DATE)
                         ORDER BY pr.vr_promocao ASC, pr.quantidade_minima ASC LIMIT 1) AS promocao_data_fim
                 FROM cad_produtos p
                 LEFT JOIN cad_produtos_tipo t ON t.id = p.id_tipo
                 WHERE (p.inativo IS NULL OR p.inativo = 0)`;
      const params: unknown[] = [];
      if (q) {
        sql += ' AND (p.nome_produto LIKE ? OR p.cod_barra = ?)';
        params.push(`%${q}%`, q);
      }
      if (args.id_tipo) {
        sql += ' AND p.id_tipo = ?';
        params.push(args.id_tipo);
      }
      sql += ` ORDER BY p.nome_produto ASC LIMIT ${limit}`;
      const [rows] = await pool.query<RowDataPacket[]>(sql, params);
      let result = rows;
      if (args.onlyLowMargin) {
        result = rows.filter((r) => {
          const compra = Number((r as { vr_compra: number }).vr_compra ?? 0);
          const venda = Number((r as { vr_venda: number }).vr_venda ?? 0);
          if (compra <= 0) return false;
          return ((venda - compra) / compra) < 0.2; // margem < 20%
        });
      }
      return result;
    }
  );

  ipcMain.handle(
    'erp:prices:bulk-update',
    async (_e, updates: Array<{ id: number; vr_venda?: number; vr_venda_2?: number; vr_compra?: number }>) => {
      const pool = await getPool();
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        for (const u of updates) {
          const fields: string[] = [];
          const vals: unknown[] = [];
          if (u.vr_venda !== undefined) { fields.push('vr_venda = ?'); vals.push(u.vr_venda); }
          if (u.vr_venda_2 !== undefined) { fields.push('vr_venda_2 = ?'); vals.push(u.vr_venda_2); }
          if (u.vr_compra !== undefined) { fields.push('vr_compra = ?'); vals.push(u.vr_compra); }
          if (fields.length === 0) continue;
          vals.push(u.id);
          await conn.query(`UPDATE cad_produtos SET ${fields.join(', ')} WHERE id = ?`, vals);
        }
        await conn.commit();
        return { ok: true, count: updates.length };
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }
  );

  ipcMain.handle(
    'erp:prices:apply-markup',
    async (_e, args: { productIds: number[]; markupPercent: number; base: 'compra' | 'venda' }) => {
      const pool = await getPool();
      if (args.productIds.length === 0) return { ok: true, count: 0 };
      const placeholders = args.productIds.map(() => '?').join(', ');
      const baseCol = args.base === 'compra' ? 'vr_compra' : 'vr_venda';
      const factor = 1 + args.markupPercent / 100;
      await pool.query(
        `UPDATE cad_produtos SET vr_venda = ROUND(${baseCol} * ?, 2) WHERE id IN (${placeholders}) AND ${baseCol} > 0`,
        [factor, ...args.productIds]
      );
      return { ok: true, count: args.productIds.length };
    }
  );

  // ============================================================
  // PROMOÇÕES
  // ============================================================
  ipcMain.handle(
    'erp:promotions:list',
    async (_e, args: { status?: 'active' | 'scheduled' | 'expired' | 'all' } = {}) => {
      await ensurePromoTable();
      const pool = await getPool();
      let sql = `SELECT pr.*, p.nome_produto, p.cod_barra, p.unidade, p.vr_venda AS vr_venda_original
                 FROM cad_produtos_promocao pr
                 LEFT JOIN cad_produtos p ON p.id = pr.id_produto
                 WHERE 1=1`;
      if (args.status === 'active') sql += ` AND pr.inativo = 0 AND pr.data_inicio <= CURRENT_DATE AND (pr.data_fim IS NULL OR pr.data_fim >= CURRENT_DATE)`;
      if (args.status === 'scheduled') sql += ` AND pr.inativo = 0 AND pr.data_inicio > CURRENT_DATE`;
      if (args.status === 'expired') sql += ` AND (pr.data_fim IS NOT NULL AND pr.data_fim < CURRENT_DATE)`;
      sql += ' ORDER BY pr.data_inicio DESC, pr.id DESC LIMIT 500';
      const [rows] = await pool.query<RowDataPacket[]>(sql);
      return rows;
    }
  );

  ipcMain.handle(
    'erp:promotions:save',
    async (
      _e,
      data: {
        id?: number;
        id_produto: number;
        descricao?: string | null;
        vr_promocao: number;
        quantidade_minima?: number;
        data_inicio: string;
        data_fim?: string | null;
        inativo?: number;
      }
    ) => {
      await ensurePromoTable();
      const pool = await getPool();
      const qtdMin = Math.max(1, Number(data.quantidade_minima ?? 1));
      if (data.id) {
        await pool.query(
          `UPDATE cad_produtos_promocao
           SET id_produto = ?, descricao = ?, vr_promocao = ?, quantidade_minima = ?, data_inicio = ?, data_fim = ?, inativo = ?
           WHERE id = ?`,
          [data.id_produto, data.descricao ?? null, data.vr_promocao, qtdMin, data.data_inicio, data.data_fim ?? null, data.inativo ?? 0, data.id]
        );
        return { id: data.id };
      }
      const [r] = await pool.query<ResultSetHeader>(
        `INSERT INTO cad_produtos_promocao (id_produto, descricao, vr_promocao, quantidade_minima, data_inicio, data_fim, inativo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [data.id_produto, data.descricao ?? null, data.vr_promocao, qtdMin, data.data_inicio, data.data_fim ?? null, data.inativo ?? 0]
      );
      return { id: r.insertId };
    }
  );

  ipcMain.handle(
    'erp:promotions:save-bulk',
    async (
      _e,
      args: {
        items: Array<{ id_produto: number; vr_promocao: number; quantidade_minima?: number }>;
        descricao?: string;
        data_inicio: string;
        data_fim?: string | null;
      }
    ) => {
      await ensurePromoTable();
      const pool = await getPool();
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        for (const it of args.items) {
          const qtdMin = Math.max(1, Number(it.quantidade_minima ?? 1));
          await conn.query(
            `INSERT INTO cad_produtos_promocao (id_produto, descricao, vr_promocao, quantidade_minima, data_inicio, data_fim, inativo)
             VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [it.id_produto, args.descricao ?? null, it.vr_promocao, qtdMin, args.data_inicio, args.data_fim ?? null]
          );
        }
        await conn.commit();
        return { ok: true, count: args.items.length };
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }
  );

  ipcMain.handle('erp:promotions:toggle', async (_e, id: number, inativo: boolean) => {
    await ensurePromoTable();
    const pool = await getPool();
    await pool.query('UPDATE cad_produtos_promocao SET inativo = ? WHERE id = ?', [inativo ? 1 : 0, id]);
    return { ok: true };
  });

  ipcMain.handle('erp:promotions:delete', async (_e, id: number) => {
    await ensurePromoTable();
    const pool = await getPool();
    await pool.query('DELETE FROM cad_produtos_promocao WHERE id = ?', [id]);
    return { ok: true };
  });

  // ============================================================
  // ESTOQUE
  // ============================================================
  ipcMain.handle(
    'erp:stock:history',
    async (
      _e,
      args: { from?: string; to?: string; id_produto?: number; tipo?: 'N' | 'A' | 'S' | 'I' | 'all'; limit?: number; offset?: number } = {}
    ) => {
      const pool = await getPool();
      const limit = Math.min(args.limit ?? 100, 500);
      const offset = args.offset ?? 0;
      // Check if the new columns exist (backward compat)
      const [[hasTipo]] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'mv_estoque_historico' AND column_name = 'tipo'`
      );
      const tipoSel = (hasTipo as { c: number }).c > 0 ? ', h.tipo, h.motivo' : `, 'N' AS tipo, NULL AS motivo`;
      let sql = `SELECT h.*${tipoSel}, p.nome_produto, f.nome_fornecedor, ml.modo_lancamento
                 FROM mv_estoque_historico h
                 LEFT JOIN cad_produtos p ON p.id = h.id_produto
                 LEFT JOIN cad_fornecedores f ON f.id = h.id_fornecedor
                 LEFT JOIN cad_modo_lancamento ml ON ml.id = h.modo_lancamento
                 WHERE 1=1`;
      const params: unknown[] = [];
      if (args.from) { sql += ' AND h.data_entrada >= ?'; params.push(args.from); }
      if (args.to) { sql += ' AND h.data_entrada <= ?'; params.push(args.to); }
      if (args.id_produto) { sql += ' AND h.id_produto = ?'; params.push(args.id_produto); }
      if (args.tipo && args.tipo !== 'all' && (hasTipo as { c: number }).c > 0) {
        sql += ' AND h.tipo = ?';
        params.push(args.tipo);
      }
      sql += ` ORDER BY h.id DESC LIMIT ${limit} OFFSET ${offset}`;
      const [rows] = await pool.query<RowDataPacket[]>(sql, params);
      return rows;
    }
  );

  ipcMain.handle(
    'erp:stock:entry',
    async (
      _e,
      args: {
        id_produto: number;
        id_fornecedor?: number;
        quantidade: number;
        valor?: number;
        nota_entrada?: string;
        data_entrada?: string;
      }
    ) => {
      const pool = await getPool();
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const dt = args.data_entrada ?? new Date().toISOString().slice(0, 10);
        await conn.query(
          `INSERT INTO mv_estoque_historico
           (modo_lancamento, nota_entrada, id_fornecedor, id_produto, id_grade, data_entrada, quantidade, valor, tipo)
           VALUES (1, ?, ?, ?, 0, ?, ?, ?, 'N')`,
          [args.nota_entrada ?? '', args.id_fornecedor ?? 0, args.id_produto, dt, args.quantidade, args.valor ?? 0]
        );
        await conn.query(
          `UPDATE cad_produtos SET estoque = COALESCE(estoque, 0) + ? WHERE id = ?`,
          [args.quantidade, args.id_produto]
        );
        await conn.commit();
        return { ok: true };
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }
  );

  /**
   * Manual stock adjustments (não confundir com entrada de NF-e).
   * tipo: 'A' = ajuste positivo (+ estoque), 'S' = ajuste negativo (- estoque), 'I' = inventário (define valor absoluto)
   */
  ipcMain.handle(
    'erp:stock:adjust',
    async (
      _e,
      args: {
        id_produto: number;
        tipo: 'A' | 'S' | 'I';
        quantidade: number;
        motivo: string;
        data_entrada?: string;
      }
    ) => {
      const pool = await getPool();
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const dt = args.data_entrada ?? new Date().toISOString().slice(0, 10);

        const [[cur]] = await conn.query<RowDataPacket[]>(
          'SELECT COALESCE(estoque, 0) AS estoque FROM cad_produtos WHERE id = ?',
          [args.id_produto]
        );
        const currentStock = Number((cur as { estoque: number }).estoque);

        let delta = 0;
        let newStock = currentStock;
        if (args.tipo === 'A') {
          delta = args.quantidade;
          newStock = currentStock + args.quantidade;
        } else if (args.tipo === 'S') {
          delta = -args.quantidade;
          newStock = currentStock - args.quantidade;
        } else if (args.tipo === 'I') {
          delta = args.quantidade - currentStock;
          newStock = args.quantidade;
        }

        // Register the movement — quantidade stored as the signed delta for clarity in reports
        await conn.query(
          `INSERT INTO mv_estoque_historico
           (modo_lancamento, nota_entrada, id_fornecedor, id_produto, id_grade, data_entrada, quantidade, valor, tipo, motivo)
           VALUES (1, ?, 0, ?, 0, ?, ?, 0, ?, ?)`,
          [args.tipo === 'I' ? 'INVENTARIO' : args.tipo === 'A' ? 'AJUSTE+' : 'AJUSTE-', args.id_produto, dt, delta, args.tipo, args.motivo]
        );
        await conn.query('UPDATE cad_produtos SET estoque = ? WHERE id = ?', [newStock, args.id_produto]);
        await conn.commit();
        return { ok: true, delta, newStock };
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }
  );

  // ============================================================
  // ENTRADA POR NF-e (XML do fornecedor)
  // ============================================================
  ipcMain.handle('erp:nfe:pick-file', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const r = await dialog.showOpenDialog(win!, {
      title: 'Selecione o XML da NF-e',
      properties: ['openFile'],
      filters: [{ name: 'NF-e XML', extensions: ['xml'] }],
    });
    if (r.canceled || r.filePaths.length === 0) return null;
    const filePath = r.filePaths[0];
    const content = await fs.readFile(filePath, 'utf8');
    try {
      const parsed = parseNFeXml(content);
      return { filePath, xml: content, parsed };
    } catch (e) {
      throw new Error(`Não foi possível ler o XML: ${(e as Error).message}`);
    }
  });

  ipcMain.handle('erp:nfe:parse', async (_e, xml: string) => parseNFeXml(xml));

  /**
   * Given a parsed NFe, return each item matched (or not) against existing products.
   * Match strategy: 1) exact cEAN (barcode), 2) exact nome_produto, 3) unmatched
   */
  ipcMain.handle('erp:nfe:match-items', async (_e, items: NFeItem[]) => {
    const pool = await getPool();
    const results = [] as Array<{
      item: NFeItem;
      matchedProductId: number | null;
      matchedBy: 'barcode' | 'name' | null;
      matchedName?: string;
      matchedPrice?: number;
      matchedStock?: number;
    }>;
    for (const item of items) {
      let matchedProductId: number | null = null;
      let matchedBy: 'barcode' | 'name' | null = null;
      let matchedName: string | undefined;
      let matchedPrice: number | undefined;
      let matchedStock: number | undefined;
      if (item.cEAN) {
        const [rows] = await pool.query<RowDataPacket[]>(
          'SELECT id, nome_produto, vr_venda, estoque FROM cad_produtos WHERE cod_barra = ? LIMIT 1',
          [item.cEAN]
        );
        if (rows.length > 0) {
          matchedProductId = (rows[0] as { id: number }).id;
          matchedBy = 'barcode';
          matchedName = (rows[0] as { nome_produto: string }).nome_produto;
          matchedPrice = Number((rows[0] as { vr_venda: number }).vr_venda);
          matchedStock = Number((rows[0] as { estoque: number }).estoque);
        }
      }
      if (!matchedProductId && item.xProd) {
        const [rows] = await pool.query<RowDataPacket[]>(
          'SELECT id, nome_produto, vr_venda, estoque FROM cad_produtos WHERE nome_produto = ? LIMIT 1',
          [item.xProd]
        );
        if (rows.length > 0) {
          matchedProductId = (rows[0] as { id: number }).id;
          matchedBy = 'name';
          matchedName = (rows[0] as { nome_produto: string }).nome_produto;
          matchedPrice = Number((rows[0] as { vr_venda: number }).vr_venda);
          matchedStock = Number((rows[0] as { estoque: number }).estoque);
        }
      }
      results.push({ item, matchedProductId, matchedBy, matchedName, matchedPrice, matchedStock });
    }
    return results;
  });

  ipcMain.handle(
    'erp:nfe:import',
    async (
      _e,
      args: {
        parsed: NFeParsed;
        // Per-item decisions
        mappings: Array<{
          item: NFeItem;
          action: 'create' | 'update' | 'skip';
          productId?: number;
          suggestedPrice?: number;
        }>;
        supplierId: number | null; // if null, will auto-create from emitente
        markupPercent?: number; // optional markup to apply on the cost to define vr_venda for new products
      }
    ) => {
      const pool = await getPool();
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // Ensure supplier exists
        let idFornecedor = args.supplierId ?? 0;
        if (!idFornecedor && args.parsed.emitente.CNPJ) {
          const cnpj = args.parsed.emitente.CNPJ;
          const [existing] = await conn.query<RowDataPacket[]>(
            'SELECT id FROM cad_fornecedores WHERE cpf_cnpj = ? OR REPLACE(REPLACE(REPLACE(cpf_cnpj, ".", ""), "/", ""), "-", "") = ? LIMIT 1',
            [cnpj, cnpj]
          );
          if (existing.length > 0) {
            idFornecedor = (existing[0] as { id: number }).id;
          } else {
            const [ins] = await conn.query<ResultSetHeader>(
              `INSERT INTO cad_fornecedores (nome_fornecedor, cpf_cnpj, rg_ie, endereco, bairro, cidade, uf, cep, telefone)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                args.parsed.emitente.xNome,
                cnpj,
                args.parsed.emitente.IE ?? '',
                `${args.parsed.emitente.xLgr ?? ''} ${args.parsed.emitente.nro ?? ''}`.trim(),
                args.parsed.emitente.xBairro ?? '',
                args.parsed.emitente.xMun ?? '',
                args.parsed.emitente.UF ?? '',
                args.parsed.emitente.CEP ?? '',
                args.parsed.emitente.fone ?? '',
              ]
            );
            idFornecedor = ins.insertId;
          }
        }

        const markup = args.markupPercent ?? 0;
        const numeroNota = args.parsed.numero;
        const dataEntrada = args.parsed.dataEmissao ? args.parsed.dataEmissao.slice(0, 10) : new Date().toISOString().slice(0, 10);

        let created = 0;
        let updated = 0;
        let skipped = 0;

        for (const m of args.mappings) {
          const it = m.item;
          if (m.action === 'skip') { skipped++; continue; }

          let idProduto = m.productId;
          if (m.action === 'create') {
            const vrVenda = m.suggestedPrice ?? (markup > 0 ? it.vUnCom * (1 + markup / 100) : it.vUnCom);
            const [ins] = await conn.query<ResultSetHeader>(
              `INSERT INTO cad_produtos (nome_produto, cod_barra, unidade, vr_compra, vr_venda, estoque, min_estoque, ncm, cfop, cst_csosn, cest, origem_produto, inativo)
               VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, NULL, ?, ?, 0)`,
              [
                it.xProd.slice(0, 60),
                it.cEAN,
                it.uCom.slice(0, 3),
                it.vUnCom,
                vrVenda,
                it.NCM,
                it.CFOP,
                it.CEST,
                it.origem ?? 0,
              ]
            );
            idProduto = ins.insertId;
            created++;
          } else {
            // update: bump cost, keep sale price, optionally recompute if markup > 0
            if (markup > 0 && m.suggestedPrice !== undefined) {
              await conn.query(
                'UPDATE cad_produtos SET vr_compra = ?, vr_venda = ? WHERE id = ?',
                [it.vUnCom, m.suggestedPrice, idProduto]
              );
            } else {
              await conn.query('UPDATE cad_produtos SET vr_compra = ? WHERE id = ?', [it.vUnCom, idProduto]);
            }
            updated++;
          }

          if (!idProduto) continue;

          // Add stock and history
          await conn.query(
            `INSERT INTO mv_estoque_historico
             (modo_lancamento, nota_entrada, id_fornecedor, id_produto, id_grade, data_entrada, quantidade, valor)
             VALUES (1, ?, ?, ?, 0, ?, ?, ?)`,
            [numeroNota, idFornecedor, idProduto, dataEntrada, it.qCom, it.vUnCom]
          );
          await conn.query('UPDATE cad_produtos SET estoque = COALESCE(estoque, 0) + ? WHERE id = ?', [it.qCom, idProduto]);

          // Link product to supplier if not linked yet
          if (idFornecedor) {
            await conn.query(
              'INSERT IGNORE INTO cad_produtos_fornecedores (id_produto, id_fornecedor) VALUES (?, ?)',
              [idProduto, idFornecedor]
            );
          }
        }

        await conn.commit();
        return { ok: true, created, updated, skipped, idFornecedor, numeroNota };
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }
  );

  ipcMain.handle('erp:stock:low', async () => {
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, nome_produto, unidade, estoque, min_estoque
       FROM cad_produtos
       WHERE (inativo IS NULL OR inativo = 0)
         AND min_estoque > 0 AND COALESCE(estoque, 0) <= min_estoque
       ORDER BY (min_estoque - estoque) DESC LIMIT 50`
    );
    return rows;
  });

  // ============================================================
  // FINANCEIRO
  // ============================================================
  ipcMain.handle('erp:finance:accounts', async () => {
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM cad_conta ORDER BY conta_descricao ASC');
    return rows;
  });

  ipcMain.handle('erp:finance:save-account', async (_e, data: Record<string, unknown>) => {
    const pool = await getPool();
    const id = data.id as number | undefined;
    const cleaned = { ...data };
    delete cleaned.id;
    if (id) {
      const q = buildUpdate('cad_conta', cleaned, id);
      await pool.query(q.sql, q.values);
      return { id };
    }
    const q = buildInsert('cad_conta', cleaned);
    const [r] = await pool.query<ResultSetHeader>(q.sql, q.values);
    return { id: r.insertId };
  });

  ipcMain.handle('erp:finance:plans', async () => {
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, plane_cod, plane_descricao, plane_tipo FROM cad_planejamento ORDER BY plane_cod ASC`
    );
    return rows;
  });

  ipcMain.handle(
    'erp:finance:launches:list',
    async (
      _e,
      args: { from?: string; to?: string; tipo?: 'E' | 'S' | 'all'; status?: 'pending' | 'paid' | 'all' } = {}
    ) => {
      const pool = await getPool();
      let sql = `SELECT l.*, c.conta_descricao, ml.modo_lancamento,
                        pl.plane_descricao, pl.plane_tipo,
                        cli.nome_cliente
                 FROM cad_lancamentos l
                 LEFT JOIN cad_conta c ON c.id = l.id_conta
                 LEFT JOIN cad_modo_lancamento ml ON ml.id = l.id_modo_lancamento
                 LEFT JOIN cad_planejamento pl ON pl.id = l.id_planejamento
                 LEFT JOIN cad_clientes cli ON cli.id = l.id_cliente
                 WHERE 1=1`;
      const params: unknown[] = [];
      if (args.from) { sql += ' AND l.data_vencimento >= ?'; params.push(args.from); }
      if (args.to) { sql += ' AND l.data_vencimento <= ?'; params.push(args.to); }
      if (args.tipo && args.tipo !== 'all') { sql += ' AND pl.plane_tipo = ?'; params.push(args.tipo); }
      if (args.status === 'pending') sql += ` AND (l.data_confirmacao IS NULL OR l.data_confirmacao = '0000-00-00')`;
      if (args.status === 'paid') sql += ` AND l.data_confirmacao IS NOT NULL AND l.data_confirmacao != '0000-00-00'`;
      sql += ' ORDER BY l.data_vencimento ASC LIMIT 500';
      const [rows] = await pool.query<RowDataPacket[]>(sql, params);
      return rows;
    }
  );

  ipcMain.handle('erp:finance:launches:save', async (_e, data: Record<string, unknown>) => {
    const pool = await getPool();
    const id = data.id as number | undefined;
    const cleaned = { ...data };
    delete cleaned.id;
    delete cleaned.conta_descricao;
    delete cleaned.modo_lancamento;
    delete cleaned.plane_descricao;
    delete cleaned.plane_tipo;
    delete cleaned.nome_cliente;
    if (id) {
      const q = buildUpdate('cad_lancamentos', cleaned, id);
      await pool.query(q.sql, q.values);
      return { id };
    }
    if (!cleaned.controle) cleaned.controle = Date.now().toString(36).toUpperCase().slice(0, 14);
    const q = buildInsert('cad_lancamentos', cleaned);
    const [r] = await pool.query<ResultSetHeader>(q.sql, q.values);
    return { id: r.insertId };
  });

  ipcMain.handle(
    'erp:finance:launches:mark-paid',
    async (_e, args: { id: number; data_confirmacao: string; vr_pago: number; id_modo_lancamento?: number }) => {
      const pool = await getPool();
      await pool.query(
        `UPDATE cad_lancamentos
         SET data_confirmacao = ?, vr_parcela = ?, id_modo_lancamento = COALESCE(?, id_modo_lancamento), status_lancamento = 2
         WHERE id = ?`,
        [args.data_confirmacao, args.vr_pago, args.id_modo_lancamento ?? null, args.id]
      );
      return { ok: true };
    }
  );

  ipcMain.handle('erp:finance:summary', async () => {
    const pool = await getPool();
    const [[receivable]] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(l.vr_parcela),0) AS total, COUNT(*) AS qtd
       FROM cad_lancamentos l JOIN cad_planejamento pl ON pl.id = l.id_planejamento
       WHERE pl.plane_tipo = 'E' AND (l.data_confirmacao IS NULL OR l.data_confirmacao = '0000-00-00')`
    );
    const [[payable]] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(l.vr_parcela),0) AS total, COUNT(*) AS qtd
       FROM cad_lancamentos l JOIN cad_planejamento pl ON pl.id = l.id_planejamento
       WHERE pl.plane_tipo = 'S' AND (l.data_confirmacao IS NULL OR l.data_confirmacao = '0000-00-00')`
    );
    const [[overdue]] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(vr_parcela),0) AS total, COUNT(*) AS qtd
       FROM cad_lancamentos
       WHERE (data_confirmacao IS NULL OR data_confirmacao = '0000-00-00')
         AND data_vencimento < CURRENT_DATE`
    );
    return { receivable, payable, overdue };
  });

  ipcMain.handle('erp:finance:payment-methods', async () => {
    const pool = await getPool();
    const [[hasInativo]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'cad_modo_lancamento' AND column_name = 'inativo'`
    );
    const whereClause = (hasInativo as { c: number }).c > 0 ? 'WHERE COALESCE(inativo, 0) = 0' : '';
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, modo_lancamento FROM cad_modo_lancamento ${whereClause} ORDER BY id ASC`
    );
    return rows;
  });

  // ============================================================
  // DASHBOARD stats
  // ============================================================
  ipcMain.handle('erp:dashboard:stats', async () => {
    const pool = await getPool();
    const [[today]] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(vr_total),0) AS total, COUNT(*) AS pedidos
       FROM mv_vendas WHERE data_venda = CURRENT_DATE`
    );
    const [[month]] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(vr_total),0) AS total, COUNT(*) AS pedidos
       FROM mv_vendas WHERE date_trunc('month', data_venda) = date_trunc('month', CURRENT_DATE)`
    );
    const [[products]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM cad_produtos WHERE inativo IS NULL OR inativo = 0`
    );
    const [[clients]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM cad_clientes WHERE inativo IS NULL OR inativo = 0`
    );
    const [dailyChart] = await pool.query<RowDataPacket[]>(
      `SELECT data_venda AS dia, COALESCE(SUM(vr_total),0) AS total
       FROM mv_vendas
       WHERE data_venda >= CURRENT_DATE - INTERVAL '6 days'
       GROUP BY data_venda ORDER BY data_venda ASC`
    );
    const [topProducts] = await pool.query<RowDataPacket[]>(
      `SELECT p.nome_produto, SUM(m.quant) AS total_qtd, SUM(m.vr_total) AS total_valor
       FROM mv_vendas_movimento m
       JOIN cad_produtos p ON p.id = m.id_produto
       WHERE m.data_venda >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY p.id, p.nome_produto
       ORDER BY total_qtd DESC LIMIT 5`
    );
    return {
      today,
      month,
      productCount: (products as { total: number }).total,
      clientCount: (clients as { total: number }).total,
      dailyChart,
      topProducts,
    };
  });
}
