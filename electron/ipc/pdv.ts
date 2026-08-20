import { ipcMain } from 'electron';
import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getPool } from '../services/db';
import { getConfig } from '../services/config';

export type ProductRow = {
  id: number;
  nome_produto: string;
  cod_barra: string | null;
  unidade: string | null;
  vr_venda: number | null;
  vr_venda_2: number | null;
  estoque: number | null;
  id_tipo: number | null;
  fracionado: number | null;
  inativo: number | null;
};

export type SaleItem = {
  id_produto: number;
  nome_produto: string;
  valor: number;
  quant: number;
  vr_total: number;
};

export type PaymentEntry = {
  cod_lancamento: number; // id em cad_modo_lancamento
  valor: number;
};

export type SavedSale = {
  items: SaleItem[];
  payments: PaymentEntry[];
  id_cliente?: number;
  vr_total: number;
  vr_desconto?: number;
  vr_troco?: number;
  observacao?: string;
};

function nowDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nowTime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function makeControl(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase().slice(0, 14);
}

export function registerPdvHandlers(): void {
  ipcMain.handle('pdv:list-products', async (_e, args: { search?: string; limit?: number; id_tipo?: number | null } = {}) => {
    const pool = await getPool();
    const limit = Math.min(args.limit ?? 60, 200);
    const q = (args.search ?? '').trim();
    let sql = `SELECT id, nome_produto, cod_barra, unidade, vr_venda, vr_venda_2, estoque, id_tipo, fracionado, inativo
               FROM cad_produtos
               WHERE (inativo IS NULL OR inativo = 0)`;
    const params: unknown[] = [];
    if (q) {
      sql += ` AND (cod_barra = ? OR nome_produto LIKE ? OR id = ?)`;
      params.push(q, `%${q}%`, /^\d+$/.test(q) ? Number(q) : -1);
    }
    if (args.id_tipo) {
      sql += ' AND id_tipo = ?';
      params.push(args.id_tipo);
    }
    sql += ` ORDER BY nome_produto ASC LIMIT ${limit}`;
    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    return rows as ProductRow[];
  });

  ipcMain.handle('pdv:top-sellers', async (_e, args: { limit?: number; days?: number } = {}) => {
    const pool = await getPool();
    const limit = Math.min(args.limit ?? 12, 30);
    const days = args.days ?? 30;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.id, p.nome_produto, p.cod_barra, p.unidade, p.vr_venda, p.estoque, p.id_tipo, p.fracionado,
              SUM(m.quant) AS total_vendido
       FROM cad_produtos p
       JOIN mv_vendas_movimento m ON m.id_produto = p.id
       WHERE (p.inativo IS NULL OR p.inativo = 0)
         AND m.data_venda >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY p.id
       ORDER BY total_vendido DESC LIMIT ${limit}`,
      [days]
    );
    return rows;
  });

  ipcMain.handle('pdv:list-categories', async () => {
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT t.id, t.nome_tipo, COUNT(p.id) AS produtos
       FROM cad_produtos_tipo t
       LEFT JOIN cad_produtos p ON p.id_tipo = t.id AND (p.inativo IS NULL OR p.inativo = 0)
       GROUP BY t.id, t.nome_tipo
       ORDER BY t.nome_tipo ASC`
    );
    return rows;
  });

  ipcMain.handle('pdv:find-product-by-code', async (_e, code: string) => {
    const pool = await getPool();
    // First: direct match on cod_barra or id
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, nome_produto, cod_barra, unidade, vr_venda, vr_venda_2, estoque, id_tipo, fracionado
       FROM cad_produtos WHERE cod_barra = ? OR id = ? LIMIT 1`,
      [code, /^\d+$/.test(code) ? Number(code) : -1]
    );
    if (rows[0]) return rows[0] as ProductRow;
    // Fallback: search alternative codes (EAN variants, supplier codes, scale codes).
    // Table may not exist yet on older installs — swallow error to keep PDV working.
    try {
      const [alt] = await pool.query<RowDataPacket[]>(
        `SELECT p.id, p.nome_produto, p.cod_barra, p.unidade, p.vr_venda, p.vr_venda_2, p.estoque, p.id_tipo, p.fracionado
         FROM cad_produtos_codigos c
         JOIN cad_produtos p ON p.id = c.id_produto
         WHERE c.codigo = ?
           AND COALESCE(c.inativo, 0) = 0
           AND COALESCE(c.util_venda, 1) = 1
           AND (p.inativo IS NULL OR p.inativo = 0)
         LIMIT 1`,
        [code]
      );
      if (alt[0]) return alt[0] as ProductRow;

      // Scale-printed EAN-13: "2" + PLU (var length) + weight/price digits + check digit.
      // Match by BALANCA-tipo code as a prefix of the digits after the "2".
      if (/^2\d{12}$/.test(code)) {
        const plusInner = code.slice(1, 12); // digits between prefix and check digit
        const [scaleRows] = await pool.query<RowDataPacket[]>(
          `SELECT p.id, p.nome_produto, p.cod_barra, p.unidade, p.vr_venda, p.vr_venda_2, p.estoque, p.id_tipo, p.fracionado
           FROM cad_produtos_codigos c
           JOIN cad_produtos p ON p.id = c.id_produto
           WHERE c.tipo = 'BALANCA'
             AND COALESCE(c.inativo, 0) = 0
             AND COALESCE(c.util_venda, 1) = 1
             AND (p.inativo IS NULL OR p.inativo = 0)
             AND LEFT(?, CHAR_LENGTH(c.codigo)) = c.codigo
           ORDER BY CHAR_LENGTH(c.codigo) DESC
           LIMIT 1`,
          [plusInner]
        );
        if (scaleRows[0]) return scaleRows[0] as ProductRow;
      }
      return null;
    } catch {
      return null;
    }
  });

  ipcMain.handle('pdv:list-active-promo-tiers', async () => {
    const pool = await getPool();
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id_produto, quantidade_minima, vr_promocao
         FROM cad_produtos_promocao
         WHERE inativo = 0
           AND data_inicio <= CURDATE()
           AND (data_fim IS NULL OR data_fim >= CURDATE())
         ORDER BY quantidade_minima ASC`
      );
      return rows;
    } catch {
      return [];
    }
  });

  ipcMain.handle('pdv:list-payment-methods', async () => {
    const pool = await getPool();
    const [[hasInativo]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cad_modo_lancamento' AND COLUMN_NAME = 'inativo'`
    );
    const whereClause = (hasInativo as { c: number }).c > 0 ? 'WHERE COALESCE(inativo, 0) = 0' : '';
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, modo_lancamento, protegido FROM cad_modo_lancamento ${whereClause} ORDER BY id ASC`
    );
    return rows;
  });

  ipcMain.handle('pdv:search-clients', async (_e, q: string) => {
    const pool = await getPool();
    const search = `%${q ?? ''}%`;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, nome_cliente, cpf_cnpj, telefone, celular FROM cad_clientes
       WHERE (inativo IS NULL OR inativo = 0)
         AND (nome_cliente LIKE ? OR cpf_cnpj LIKE ? OR cod_barra = ?)
       LIMIT 20`,
      [search, search, q ?? '']
    );
    return rows;
  });

  ipcMain.handle('pdv:get-open-cashier', async () => {
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM mv_caixa WHERE status_caixa = 'A' ORDER BY id DESC LIMIT 1`
    );
    return rows[0] ?? null;
  });

  ipcMain.handle(
    'pdv:open-cashier',
    async (_e, args: { vr_abertura: number; id_login: number; terminal?: string; turno?: string }) => {
      const pool = await getPool();
      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO mv_caixa (hora_abertura, data_abertura, vr_abertura, id_login, terminal, turno, status_caixa)
         VALUES (?, ?, ?, ?, ?, ?, 'A')`,
        [nowTime(), nowDate(), args.vr_abertura, args.id_login, args.terminal ?? '01', args.turno ?? '1']
      );
      return { id: result.insertId };
    }
  );

  ipcMain.handle('pdv:close-cashier', async (_e, args: { id: number; vr_fechamento: number }) => {
    const pool = await getPool();
    await pool.query(
      `UPDATE mv_caixa SET status_caixa='F', hora_fechamento=?, data_fechamento=?, vr_fechamento=? WHERE id=?`,
      [nowTime(), nowDate(), args.vr_fechamento, args.id]
    );
    return { ok: true };
  });

  ipcMain.handle('pdv:cashier-summary', async (_e, id: number) => {
    const pool = await getPool();
    const [[caixa]] = await pool.query<RowDataPacket[]>('SELECT * FROM mv_caixa WHERE id = ? LIMIT 1', [id]);
    if (!caixa) return null;
    const c = caixa as { data_abertura: string; hora_abertura: string; vr_abertura: number; terminal: string };
    const [[stats]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS pedidos,
              COALESCE(SUM(vr_total), 0) AS total,
              COALESCE(SUM(vr_dinheiro), 0) AS dinheiro,
              COALESCE(SUM(vr_cheque), 0) AS cheque,
              COALESCE(SUM(vr_cartao), 0) AS cartao,
              COALESCE(SUM(vr_carne), 0) AS carne,
              COALESCE(SUM(vr_ticket), 0) AS ticket
       FROM mv_vendas
       WHERE data_venda = ? AND terminal = ?`,
      [c.data_abertura, c.terminal]
    );

    // Sangria (S) and suprimento (A)
    let sangrias = 0;
    let suprimentos = 0;
    const [[cashMovCheck]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mv_caixa_movimento'`
    );
    if ((cashMovCheck as { c: number }).c > 0) {
      const [[mov]] = await pool.query<RowDataPacket[]>(
        `SELECT
          COALESCE(SUM(CASE WHEN tipo='S' THEN valor ELSE 0 END), 0) AS sangrias,
          COALESCE(SUM(CASE WHEN tipo='A' THEN valor ELSE 0 END), 0) AS suprimentos
         FROM mv_caixa_movimento WHERE id_caixa = ?`,
        [id]
      );
      sangrias = Number((mov as { sangrias: number }).sangrias);
      suprimentos = Number((mov as { suprimentos: number }).suprimentos);
    }

    return { caixa, stats, sangrias, suprimentos };
  });

  ipcMain.handle(
    'pdv:cash-movement',
    async (_e, args: { id_caixa: number; tipo: 'S' | 'A'; valor: number; descricao?: string; id_login?: number }) => {
      const pool = await getPool();
      const [result] = await pool.query<import('mysql2').ResultSetHeader>(
        `INSERT INTO mv_caixa_movimento (id_caixa, tipo, valor, descricao, id_login) VALUES (?, ?, ?, ?, ?)`,
        [args.id_caixa, args.tipo, args.valor, args.descricao ?? null, args.id_login ?? 1]
      );
      return { ok: true, id: result.insertId };
    }
  );

  ipcMain.handle('pdv:list-cash-movements', async (_e, id_caixa: number) => {
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM mv_caixa_movimento WHERE id_caixa = ? ORDER BY id DESC`,
      [id_caixa]
    );
    return rows;
  });

  ipcMain.handle('pdv:save-sale', async (_e, sale: SavedSale & { id_login?: number; terminal?: string; turno?: string }) => {
    const pool = await getPool();
    const conn: PoolConnection = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const control = makeControl();
      const dataVenda = nowDate();
      const idLogin = sale.id_login ?? 1;
      const terminal = sale.terminal ?? '01';
      const turno = sale.turno ?? '1';
      const codLancamento = sale.payments[0]?.cod_lancamento ?? 1;

      // Categorize payment totals for legacy columns
      const totalsBy: Record<string, number> = { dinheiro: 0, cheque: 0, cartao: 0, carne: 0, ticket: 0 };
      for (const p of sale.payments) {
        if (p.cod_lancamento === 1) totalsBy.dinheiro += p.valor;
        else if (p.cod_lancamento === 2) totalsBy.cheque += p.valor;
        else if (p.cod_lancamento === 6 || p.cod_lancamento === 7) totalsBy.cartao += p.valor;
        else if (p.cod_lancamento === 5) totalsBy.carne += p.valor;
        else if (p.cod_lancamento === 8) totalsBy.ticket += p.valor;
      }

      // Header
      const [venda] = await conn.query<ResultSetHeader>(
        `INSERT INTO mv_vendas
         (controle, data_venda, parcelas, id_cliente, id_login, terminal, turno,
          vr_total, vr_adicional, vr_dinheiro, vr_cheque, vr_cartao, vr_carne, vr_ticket,
          em_aberto, vr_pagto_parcial, cod_lancamento)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          control,
          dataVenda,
          1,
          sale.id_cliente ?? 0,
          idLogin,
          terminal,
          turno,
          sale.vr_total,
          sale.vr_desconto ?? 0,
          totalsBy.dinheiro,
          totalsBy.cheque,
          totalsBy.cartao,
          totalsBy.carne,
          totalsBy.ticket,
          0,
          0,
          codLancamento,
        ]
      );
      const idVenda = venda.insertId;

      // Items
      for (const item of sale.items) {
        await conn.query(
          `INSERT INTO mv_vendas_movimento
           (data_venda, controle, modo_venda, cod_lancamento, id_login, id_cliente,
            id_produto, id_grade, modo_lancamento, terminal, turno,
            valor, quant, vr_total, vr_cotacao)
           VALUES (?, ?, 0, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 1)`,
          [
            dataVenda,
            control,
            codLancamento,
            idLogin,
            sale.id_cliente ?? 0,
            item.id_produto,
            codLancamento,
            terminal,
            turno,
            item.valor,
            item.quant,
            item.vr_total,
          ]
        );

        // decrease stock (only if produto has estoque control)
        await conn.query(
          `UPDATE cad_produtos SET estoque = COALESCE(estoque,0) - ? WHERE id = ?`,
          [item.quant, item.id_produto]
        );
      }

      if (sale.observacao) {
        await conn.query(`INSERT INTO mv_vendas_obs (id_venda, controle, observacao) VALUES (?, ?, ?)`, [
          idVenda,
          control,
          sale.observacao,
        ]);
      }

      await conn.commit();
      return { ok: true, idVenda, control };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  });

  ipcMain.handle('pdv:daily-summary', async () => {
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS pedidos, COALESCE(SUM(vr_total),0) AS total
       FROM mv_vendas WHERE data_venda = CURDATE()`
    );
    return rows[0];
  });

  // Helper to fetch company data for the receipt
  ipcMain.handle('pdv:get-company', async () => {
    const cfg = getConfig();
    const id = cfg.get('company.id');
    if (!id) return null;
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM cad_empresa WHERE id = ?', [id]);
    return rows[0] ?? null;
  });
}
