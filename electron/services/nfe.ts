import { XMLParser } from 'fast-xml-parser';

export type NFeItem = {
  n: number;
  cProd: string; // código interno do fornecedor
  cEAN: string | null; // código de barras
  xProd: string; // descrição
  NCM: string | null;
  CFOP: string | null;
  uCom: string; // unidade comercial
  qCom: number; // quantidade
  vUnCom: number; // valor unitário comercial
  vProd: number; // valor total do produto
  cEANTrib?: string | null;
  uTrib?: string;
  qTrib?: number;
  vUnTrib?: number;
  CEST?: string | null;
  origem?: number;
};

export type NFeEmitente = {
  CNPJ: string;
  xNome: string; // razão social
  xFant?: string; // nome fantasia
  IE?: string;
  xLgr?: string;
  nro?: string;
  xBairro?: string;
  xMun?: string;
  UF?: string;
  CEP?: string;
  fone?: string;
};

export type NFeParsed = {
  chave: string | null; // chave de acesso 44 dígitos
  numero: string;
  serie: string;
  dataEmissao: string;
  emitente: NFeEmitente;
  destinatarioCNPJ: string | null;
  items: NFeItem[];
  totalProdutos: number;
  totalDesconto: number;
  totalFrete: number;
  totalNota: number;
};

/**
 * Parses an NF-e/NFC-e XML string (SEFAZ standard) into a structured object.
 * Handles both `<nfeProc>` (with authorization) and standalone `<NFe>` roots.
 */
export function parseNFeXml(xml: string): NFeParsed {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: true,
    trimValues: true,
    isArray: (name) => name === 'det',
  });
  const doc = parser.parse(xml) as Record<string, unknown>;

  // Navigate to infNFe
  const nfeProc = (doc.nfeProc ?? doc) as Record<string, unknown>;
  const nfe = (nfeProc.NFe ?? nfeProc) as Record<string, unknown>;
  const infNFe = nfe.infNFe as Record<string, unknown> | undefined;
  if (!infNFe) throw new Error('XML inválido: <infNFe> não encontrado. Este arquivo é uma NF-e?');

  const chave = (infNFe['@_Id'] as string | undefined)?.replace(/^NFe/, '') ?? null;

  const ide = (infNFe.ide ?? {}) as Record<string, unknown>;
  const emitRaw = (infNFe.emit ?? {}) as Record<string, unknown>;
  const destRaw = (infNFe.dest ?? {}) as Record<string, unknown>;
  const enderEmit = (emitRaw.enderEmit ?? {}) as Record<string, unknown>;
  const totalRaw = (infNFe.total ?? {}) as Record<string, unknown>;
  const ICMSTot = (totalRaw.ICMSTot ?? {}) as Record<string, unknown>;

  const emitente: NFeEmitente = {
    CNPJ: String(emitRaw.CNPJ ?? emitRaw.CPF ?? ''),
    xNome: String(emitRaw.xNome ?? ''),
    xFant: emitRaw.xFant ? String(emitRaw.xFant) : undefined,
    IE: emitRaw.IE ? String(emitRaw.IE) : undefined,
    xLgr: enderEmit.xLgr ? String(enderEmit.xLgr) : undefined,
    nro: enderEmit.nro ? String(enderEmit.nro) : undefined,
    xBairro: enderEmit.xBairro ? String(enderEmit.xBairro) : undefined,
    xMun: enderEmit.xMun ? String(enderEmit.xMun) : undefined,
    UF: enderEmit.UF ? String(enderEmit.UF) : undefined,
    CEP: enderEmit.CEP ? String(enderEmit.CEP) : undefined,
    fone: enderEmit.fone ? String(enderEmit.fone) : undefined,
  };

  const dets = (infNFe.det as unknown as Array<Record<string, unknown>>) ?? [];

  const items: NFeItem[] = dets.map((det, idx) => {
    const nItem = Number(det['@_nItem'] ?? idx + 1);
    const prod = (det.prod ?? {}) as Record<string, unknown>;
    const imposto = (det.imposto ?? {}) as Record<string, unknown>;
    const icms = (imposto.ICMS ?? {}) as Record<string, unknown>;
    // ICMS variant (ICMS00, ICMS10, CSOSN102...) — first key
    const icmsInner = Object.values(icms)[0] as Record<string, unknown> | undefined;
    const origem = icmsInner?.orig !== undefined ? Number(icmsInner.orig) : undefined;

    const cean = prod.cEAN as string | undefined;
    const ceanTrib = prod.cEANTrib as string | undefined;
    return {
      n: nItem,
      cProd: String(prod.cProd ?? ''),
      cEAN: cean && cean !== 'SEM GTIN' ? String(cean) : null,
      xProd: String(prod.xProd ?? ''),
      NCM: prod.NCM ? String(prod.NCM) : null,
      CFOP: prod.CFOP ? String(prod.CFOP) : null,
      uCom: String(prod.uCom ?? 'UN'),
      qCom: Number(prod.qCom ?? 0),
      vUnCom: Number(prod.vUnCom ?? 0),
      vProd: Number(prod.vProd ?? 0),
      cEANTrib: ceanTrib && ceanTrib !== 'SEM GTIN' ? String(ceanTrib) : null,
      uTrib: prod.uTrib ? String(prod.uTrib) : undefined,
      qTrib: prod.qTrib !== undefined ? Number(prod.qTrib) : undefined,
      vUnTrib: prod.vUnTrib !== undefined ? Number(prod.vUnTrib) : undefined,
      CEST: prod.CEST ? String(prod.CEST) : null,
      origem,
    };
  });

  return {
    chave,
    numero: String(ide.nNF ?? ''),
    serie: String(ide.serie ?? ''),
    dataEmissao: String(ide.dhEmi ?? ide.dEmi ?? ''),
    emitente,
    destinatarioCNPJ: destRaw.CNPJ ? String(destRaw.CNPJ) : destRaw.CPF ? String(destRaw.CPF) : null,
    items,
    totalProdutos: Number(ICMSTot.vProd ?? 0),
    totalDesconto: Number(ICMSTot.vDesc ?? 0),
    totalFrete: Number(ICMSTot.vFrete ?? 0),
    totalNota: Number(ICMSTot.vNF ?? 0),
  };
}
