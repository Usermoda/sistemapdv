import type { RowDataPacket, ResultSetHeader } from '../db';
import { getPool } from '../db';
import { getConfig } from '../config';
import { emitirNFCe, consultarNFCe, cancelarNFCe, type FocusNFCePayload, type FocusNFCeItem } from './focusnfe';

/**
 * Maps a payment method (cad_modo_lancamento.id) to Focus NFe forma_pagamento code
 * per SEFAZ table 14 (tPag). Reference:
 *   01 Dinheiro, 02 Cheque, 03 Cartão Crédito, 04 Cartão Débito,
 *   05 Crédito Loja, 10 Vale Alimentação, 11 Vale Refeição,
 *   12 Vale Presente, 13 Vale Combustível, 15 Boleto Bancário,
 *   17 PIX, 99 Outros.
 */
function mapPayment(codLancamento: number): string {
  switch (codLancamento) {
    case 1: return '01'; // Dinheiro
    case 2: return '02'; // Cheque
    case 4: return '15'; // Boleto
    case 5: return '05'; // Carnê / Crédito loja
    case 6: return '04'; // Cartão débito
    case 7: return '03'; // Cartão crédito
    case 8: return '10'; // Ticket
    case 11: return '17'; // Transferência (PIX aproximado)
    default: return '99';
  }
}

type SaleData = {
  header: {
    id: number;
    controle: string;
    id_cliente: number;
    vr_total: number;
    vr_adicional: number;
    vr_dinheiro: number;
    vr_cheque: number;
    vr_cartao: number;
    vr_carne: number;
    vr_ticket: number;
    cod_lancamento: number;
  };
  items: Array<{
    id: number;
    id_produto: number;
    nome_produto: string;
    unidade: string | null;
    quant: number;
    valor: number;
    vr_total: number;
    cod_barra: string | null;
    ncm: string | null;
    cfop: string | null;
    cst_csosn: string | null;
    cest: string | null;
    origem_produto: number | null;
  }>;
  cliente?: { nome_cliente?: string; cpf_cnpj?: string };
  company?: { cpf_cpnj?: string };
};

async function fetchSaleData(idVenda: number): Promise<SaleData | null> {
  const pool = await getPool();
  const [headers] = await pool.query<RowDataPacket[]>(
    `SELECT v.*, cli.nome_cliente, cli.cpf_cnpj AS cliente_cpf_cnpj
     FROM mv_vendas v LEFT JOIN cad_clientes cli ON cli.id = v.id_cliente
     WHERE v.id = ?`,
    [idVenda]
  );
  if (headers.length === 0) return null;
  const h = headers[0] as SaleData['header'] & { nome_cliente?: string; cliente_cpf_cnpj?: string };
  const [items] = await pool.query<RowDataPacket[]>(
    `SELECT m.*, p.nome_produto, p.unidade, p.cod_barra, p.ncm, p.cfop, p.cst_csosn, p.cest, p.origem_produto
     FROM mv_vendas_movimento m JOIN cad_produtos p ON p.id = m.id_produto
     WHERE m.controle = ? ORDER BY m.id ASC`,
    [h.controle]
  );
  const [company] = await pool.query<RowDataPacket[]>('SELECT cpf_cpnj FROM cad_empresa LIMIT 1');
  return {
    header: h,
    items: items as SaleData['items'],
    cliente: h.nome_cliente ? { nome_cliente: h.nome_cliente, cpf_cnpj: h.cliente_cpf_cnpj ?? undefined } : undefined,
    company: (company[0] as SaleData['company']) ?? undefined,
  };
}

function buildPayload(sale: SaleData): FocusNFCePayload {
  const cfg = getConfig();
  const cnpjEmit = (sale.company?.cpf_cpnj ?? '').replace(/\D/g, '');
  const ncmPadrao = cfg.get('fiscal.ncm_padrao') ?? '00000000';
  const cfopPadrao = cfg.get('fiscal.cfop_padrao') ?? '5102';
  const cstPadrao = cfg.get('fiscal.cst_csosn_padrao') ?? '102';
  const origemPadrao = cfg.get('fiscal.origem_padrao') ?? 0;

  const items: FocusNFCeItem[] = sale.items.map((it, idx) => ({
    numero_item: idx + 1,
    codigo_produto: it.cod_barra ?? String(it.id_produto),
    descricao: it.nome_produto,
    cfop: (it.cfop ?? cfopPadrao).replace(/\D/g, ''),
    unidade_comercial: it.unidade ?? 'UN',
    quantidade_comercial: Number(it.quant),
    valor_unitario_comercial: Number(it.valor),
    valor_unitario_tributavel: Number(it.valor),
    unidade_tributavel: it.unidade ?? 'UN',
    quantidade_tributavel: Number(it.quant),
    codigo_ncm: (it.ncm ?? ncmPadrao).replace(/\D/g, '').padStart(8, '0').slice(0, 8),
    cest: it.cest ? it.cest.replace(/\D/g, '') : undefined,
    origem_mercadoria: it.origem_produto ?? origemPadrao,
    icms_situacao_tributaria: it.cst_csosn ?? cstPadrao,
  }));

  const formas: FocusNFCePayload['formas_pagamento'] = [];
  const push = (cod: number, valor: number) => {
    if (valor > 0) formas.push({ forma_pagamento: mapPayment(cod), valor_pagamento: valor });
  };
  push(1, Number(sale.header.vr_dinheiro));
  push(2, Number(sale.header.vr_cheque));
  push(6, Number(sale.header.vr_cartao)); // combined card total assumed débito
  push(5, Number(sale.header.vr_carne));
  push(8, Number(sale.header.vr_ticket));
  if (formas.length === 0) push(sale.header.cod_lancamento, Number(sale.header.vr_total));

  const cpfDest = sale.cliente?.cpf_cnpj ? sale.cliente.cpf_cnpj.replace(/\D/g, '') : undefined;

  return {
    cnpj_emitente: cnpjEmit,
    natureza_operacao: 'Venda ao consumidor',
    data_emissao: new Date().toISOString(),
    tipo_documento: 1,
    finalidade_emissao: 1,
    presenca_comprador: 1,
    consumidor_final: 1,
    local_destino: 1,
    cpf_destinatario: cpfDest && cpfDest.length === 11 ? cpfDest : undefined,
    nome_destinatario: sale.cliente?.nome_cliente,
    items,
    formas_pagamento: formas,
  };
}

export type EmissionResult = {
  ok: boolean;
  status: string;
  chave_nfe?: string;
  numero?: number;
  serie?: number;
  protocolo?: string;
  url_danfe?: string;
  qrcode_url?: string;
  mensagem?: string;
  emissao_id?: number;
};

export async function emitSaleAsNFCe(idVenda: number): Promise<EmissionResult> {
  const cfg = getConfig();
  if (!cfg.get('fiscal.enabled')) return { ok: false, status: 'desabilitado', mensagem: 'Emissão fiscal desabilitada' };

  const provider = cfg.get('fiscal.provider') ?? 'none';
  if (provider !== 'focusnfe') return { ok: false, status: 'sem_provider', mensagem: 'Nenhum provedor fiscal configurado' };

  const sale = await fetchSaleData(idVenda);
  if (!sale) return { ok: false, status: 'venda_nao_encontrada' };

  const ref = `pdv-${sale.header.controle}`;
  const payload = buildPayload(sale);
  const pool = await getPool();

  // Store as pending
  const [insertRes] = await pool.query<ResultSetHeader>(
    `INSERT INTO nfce_emitidas (id_venda, controle_venda, ref_externa, provider, ambiente, status, payload_json, data_emissao)
     VALUES (?, ?, ?, ?, ?, 'pendente', ?, NOW())
     ON CONFLICT (ref_externa) DO UPDATE
       SET payload_json = EXCLUDED.payload_json,
           status = 'pendente',
           data_atualizacao = NOW()`,
    [sale.header.id, sale.header.controle, ref, provider, cfg.get('fiscal.ambiente') ?? 'homologacao', JSON.stringify(payload)]
  );

  try {
    const res = await emitirNFCe(ref, payload);
    const status = res.status ?? 'erro_autorizacao';
    await pool.query(
      `UPDATE nfce_emitidas
       SET status = ?, chave_nfe = ?, numero = ?, serie = ?, protocolo = ?,
           url_danfe = ?, url_xml = ?, qrcode_url = ?, mensagem_sefaz = ?,
           response_json = ?, data_atualizacao = NOW()
       WHERE ref_externa = ?`,
      [
        status,
        res.chave_nfe ?? null,
        res.numero ?? null,
        res.serie ?? null,
        res.protocolo ?? null,
        res.url_danfe ?? null,
        res.url_xml ?? null,
        res.qrcode_url ?? null,
        res.mensagem_sefaz ?? (res.erros?.[0]?.mensagem ?? null),
        JSON.stringify(res),
        ref,
      ]
    );

    return {
      ok: status === 'autorizado',
      status,
      chave_nfe: res.chave_nfe,
      numero: res.numero,
      serie: res.serie,
      protocolo: res.protocolo,
      url_danfe: res.url_danfe,
      qrcode_url: res.qrcode_url,
      mensagem: res.mensagem_sefaz ?? res.erros?.[0]?.mensagem,
      emissao_id: insertRes.insertId,
    };
  } catch (e) {
    await pool.query(
      `UPDATE nfce_emitidas SET status = 'erro_emissao', mensagem_sefaz = ?, data_atualizacao = NOW() WHERE ref_externa = ?`,
      [(e as Error).message, ref]
    );
    return { ok: false, status: 'erro_emissao', mensagem: (e as Error).message };
  }
}

export async function pollNFCeStatus(ref: string): Promise<EmissionResult> {
  const pool = await getPool();
  try {
    const res = await consultarNFCe(ref);
    await pool.query(
      `UPDATE nfce_emitidas
       SET status = ?, chave_nfe = COALESCE(?, chave_nfe), protocolo = COALESCE(?, protocolo),
           url_danfe = COALESCE(?, url_danfe), qrcode_url = COALESCE(?, qrcode_url),
           mensagem_sefaz = COALESCE(?, mensagem_sefaz), response_json = ?, data_atualizacao = NOW()
       WHERE ref_externa = ?`,
      [
        res.status,
        res.chave_nfe ?? null,
        res.protocolo ?? null,
        res.url_danfe ?? null,
        res.qrcode_url ?? null,
        res.mensagem_sefaz ?? null,
        JSON.stringify(res),
        ref,
      ]
    );
    return {
      ok: res.status === 'autorizado',
      status: res.status,
      chave_nfe: res.chave_nfe,
      protocolo: res.protocolo,
      url_danfe: res.url_danfe,
      qrcode_url: res.qrcode_url,
      mensagem: res.mensagem_sefaz,
    };
  } catch (e) {
    return { ok: false, status: 'erro_consulta', mensagem: (e as Error).message };
  }
}

export async function cancelNFCeByRef(ref: string, justificativa: string): Promise<EmissionResult> {
  const pool = await getPool();
  const res = await cancelarNFCe(ref, justificativa);
  await pool.query(
    `UPDATE nfce_emitidas SET status = ?, mensagem_sefaz = ?, response_json = ?, data_atualizacao = NOW()
     WHERE ref_externa = ?`,
    [res.status ?? 'cancelamento_solicitado', res.mensagem_sefaz ?? null, JSON.stringify(res), ref]
  );
  return { ok: res.status === 'cancelado', status: res.status ?? 'cancelamento_solicitado', mensagem: res.mensagem_sefaz };
}

export async function getNFCeByVenda(idVenda: number) {
  const pool = await getPool();
  const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM nfce_emitidas WHERE id_venda = ? ORDER BY id DESC LIMIT 1', [idVenda]);
  return rows[0] ?? null;
}

/**
 * Retry emissions stuck in erro_emissao / erro_autorizacao or pendente.
 * Re-emits (creates new attempt) using the persisted payload.
 */
export async function retryPending(maxItems = 20): Promise<{ processed: number; ok: number; failed: number }> {
  const pool = await getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id_venda FROM nfce_emitidas
     WHERE status IN ('pendente','erro_emissao','erro_autorizacao','processando_autorizacao')
     ORDER BY id DESC LIMIT ${maxItems}`
  );
  let ok = 0;
  let failed = 0;
  for (const r of rows) {
    const idVenda = (r as { id_venda: number }).id_venda;
    try {
      const res = await emitSaleAsNFCe(idVenda);
      if (res.ok) ok++;
      else failed++;
    } catch {
      failed++;
    }
  }
  return { processed: rows.length, ok, failed };
}

export async function listPendingEmissions() {
  const pool = await getPool();
  const [[check]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'nfce_emitidas'`
  );
  if ((check as { c: number }).c === 0) return [];
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT n.*, v.controle, v.data_venda, v.vr_total
     FROM nfce_emitidas n
     LEFT JOIN mv_vendas v ON v.id = n.id_venda
     WHERE n.status IN ('pendente','erro_emissao','erro_autorizacao','processando_autorizacao')
     ORDER BY n.id DESC LIMIT 100`
  );
  return rows;
}

let retryTimer: NodeJS.Timeout | null = null;
export function startFiscalRetryScheduler(): void {
  if (retryTimer) return;
  const tick = async () => {
    try {
      const { getConfig } = await import('../config');
      if (getConfig().get('fiscal.enabled')) {
        await retryPending(5);
      }
    } catch (e) {
      console.error('Fiscal retry error:', e);
    }
  };
  // run every 5 minutes
  retryTimer = setInterval(tick, 5 * 60 * 1000);
}
