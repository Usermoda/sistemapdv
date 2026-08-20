import { ipcMain } from 'electron';
import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../services/db';

export function registerReportsHandlers(): void {
  // ---- Sales by period, grouped by day ----
  ipcMain.handle(
    'reports:sales-by-period',
    async (_e, args: { from: string; to: string }) => {
      const pool = await getPool();
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT data_venda AS dia,
                COUNT(*) AS pedidos,
                COALESCE(SUM(vr_total),0) AS total,
                COALESCE(SUM(vr_dinheiro),0) AS dinheiro,
                COALESCE(SUM(vr_cartao),0) AS cartao,
                COALESCE(SUM(vr_cheque),0) AS cheque,
                COALESCE(SUM(vr_carne),0) AS carne,
                COALESCE(SUM(vr_ticket),0) AS ticket
         FROM mv_vendas
         WHERE data_venda BETWEEN ? AND ?
         GROUP BY data_venda ORDER BY data_venda ASC`,
        [args.from, args.to]
      );
      const [[total]] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS pedidos, COALESCE(SUM(vr_total),0) AS total, COALESCE(AVG(vr_total),0) AS ticket_medio
         FROM mv_vendas WHERE data_venda BETWEEN ? AND ?`,
        [args.from, args.to]
      );
      return { rows, total };
    }
  );

  // ---- Top products sold ----
  ipcMain.handle(
    'reports:top-products',
    async (_e, args: { from: string; to: string; limit?: number }) => {
      const pool = await getPool();
      const limit = Math.min(args.limit ?? 50, 500);
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT p.id, p.nome_produto, p.unidade,
                SUM(m.quant) AS total_qtd,
                SUM(m.vr_total) AS total_valor,
                COUNT(DISTINCT m.controle) AS vendas
         FROM mv_vendas_movimento m
         JOIN cad_produtos p ON p.id = m.id_produto
         WHERE m.data_venda BETWEEN ? AND ?
         GROUP BY p.id, p.nome_produto, p.unidade
         ORDER BY total_qtd DESC LIMIT ${limit}`,
        [args.from, args.to]
      );
      return rows;
    }
  );

  // ---- Cashier closures ----
  ipcMain.handle(
    'reports:cashier-closures',
    async (_e, args: { from: string; to: string }) => {
      const pool = await getPool();
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT c.*, l.login,
                (SELECT COALESCE(SUM(vr_total),0) FROM mv_vendas v WHERE v.data_venda = c.data_abertura AND v.terminal = c.terminal) AS total_vendas,
                (SELECT COUNT(*) FROM mv_vendas v WHERE v.data_venda = c.data_abertura AND v.terminal = c.terminal) AS pedidos
         FROM mv_caixa c LEFT JOIN cad_login l ON l.id = c.id_login
         WHERE c.data_abertura BETWEEN ? AND ?
         ORDER BY c.data_abertura DESC, c.id DESC`,
        [args.from, args.to]
      );
      return rows;
    }
  );

  // ---- Payment methods breakdown ----
  ipcMain.handle(
    'reports:payment-breakdown',
    async (_e, args: { from: string; to: string }) => {
      const pool = await getPool();
      const [[row]] = await pool.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(vr_dinheiro),0) AS dinheiro,
                COALESCE(SUM(vr_cartao),0) AS cartao,
                COALESCE(SUM(vr_cheque),0) AS cheque,
                COALESCE(SUM(vr_carne),0) AS carne,
                COALESCE(SUM(vr_ticket),0) AS ticket,
                COALESCE(SUM(vr_total),0) AS total
         FROM mv_vendas WHERE data_venda BETWEEN ? AND ?`,
        [args.from, args.to]
      );
      return row;
    }
  );

  // ---- Financial (contas a pagar/receber) ----
  ipcMain.handle(
    'reports:finance',
    async (_e, args: { from: string; to: string; tipo?: 'E' | 'S' | 'all' }) => {
      const pool = await getPool();
      let sql = `SELECT l.*, pl.plane_descricao, pl.plane_tipo, c.conta_descricao,
                        cli.nome_cliente
                 FROM cad_lancamentos l
                 LEFT JOIN cad_planejamento pl ON pl.id = l.id_planejamento
                 LEFT JOIN cad_conta c ON c.id = l.id_conta
                 LEFT JOIN cad_clientes cli ON cli.id = l.id_cliente
                 WHERE l.data_vencimento BETWEEN ? AND ?`;
      const params: unknown[] = [args.from, args.to];
      if (args.tipo && args.tipo !== 'all') {
        sql += ' AND pl.plane_tipo = ?';
        params.push(args.tipo);
      }
      sql += ' ORDER BY l.data_vencimento ASC LIMIT 2000';
      const [rows] = await pool.query<RowDataPacket[]>(sql, params);
      return rows;
    }
  );

  // ---- Low stock ----
  ipcMain.handle('reports:low-stock', async () => {
    const pool = await getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, nome_produto, cod_barra, unidade, estoque, min_estoque, vr_venda, vr_compra
       FROM cad_produtos
       WHERE (inativo IS NULL OR inativo = 0) AND min_estoque > 0 AND COALESCE(estoque, 0) <= min_estoque
       ORDER BY (min_estoque - estoque) DESC`
    );
    return rows;
  });
}
