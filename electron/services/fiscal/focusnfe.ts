import { getConfig } from '../config';

const HOMO_URL = 'https://homologacao.focusnfe.com.br';
const PROD_URL = 'https://api.focusnfe.com.br';

function baseUrl(): string {
  const amb = getConfig().get('fiscal.ambiente') ?? 'homologacao';
  return amb === 'producao' ? PROD_URL : HOMO_URL;
}

function authHeader(): string {
  const token = getConfig().get('fiscal.focusnfe.token') ?? '';
  return 'Basic ' + Buffer.from(`${token}:`).toString('base64');
}

export type FocusNFCeItem = {
  numero_item: number;
  codigo_produto: string;
  descricao: string;
  cfop: string;
  unidade_comercial: string;
  quantidade_comercial: number;
  valor_unitario_comercial: number;
  valor_unitario_tributavel: number;
  unidade_tributavel: string;
  quantidade_tributavel: number;
  codigo_ncm: string;
  cest?: string;
  origem_mercadoria: number;
  icms_situacao_tributaria: string;
};

export type FocusNFCePayload = {
  cnpj_emitente: string;
  natureza_operacao: string;
  data_emissao: string;
  tipo_documento: 1;
  finalidade_emissao: 1;
  presenca_comprador: 1;
  consumidor_final: 1;
  local_destino: 1;
  cpf_destinatario?: string;
  nome_destinatario?: string;
  items: FocusNFCeItem[];
  formas_pagamento: Array<{
    forma_pagamento: string;
    valor_pagamento: number;
    tipo_integracao?: number;
  }>;
  informacoes_adicionais_contribuinte?: string;
};

export type FocusNFCeResponse = {
  status: 'autorizado' | 'processando_autorizacao' | 'erro_autorizacao' | 'cancelado' | string;
  chave_nfe?: string;
  numero?: number;
  serie?: number;
  protocolo?: string;
  url_danfe?: string;
  url_xml?: string;
  qrcode_url?: string;
  mensagem_sefaz?: string;
  status_sefaz?: string;
  ref?: string;
  erros?: Array<{ codigo: string; mensagem: string }>;
};

async function fetchJson<T>(url: string, method: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data: data as T };
}

export async function emitirNFCe(ref: string, payload: FocusNFCePayload): Promise<FocusNFCeResponse> {
  const url = `${baseUrl()}/v2/nfce?ref=${encodeURIComponent(ref)}`;
  const { status, data } = await fetchJson<FocusNFCeResponse>(url, 'POST', payload);
  if (status >= 400 && (!data.status || data.status === '')) {
    return { ...data, status: 'erro_autorizacao', mensagem_sefaz: data.mensagem_sefaz ?? `HTTP ${status}` };
  }
  return data;
}

export async function consultarNFCe(ref: string): Promise<FocusNFCeResponse> {
  const url = `${baseUrl()}/v2/nfce/${encodeURIComponent(ref)}`;
  const { status, data } = await fetchJson<FocusNFCeResponse>(url, 'GET');
  if (status === 404) return { status: 'nao_encontrada' };
  return data;
}

export async function cancelarNFCe(ref: string, justificativa: string): Promise<FocusNFCeResponse> {
  const url = `${baseUrl()}/v2/nfce/${encodeURIComponent(ref)}`;
  const { data } = await fetchJson<FocusNFCeResponse>(url, 'DELETE', { justificativa });
  return data;
}
