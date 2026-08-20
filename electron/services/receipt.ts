import { ThermalPrinter, CharacterSet, PrinterTypes } from 'node-thermal-printer';
import { getConfig } from './config';

export type ReceiptCompany = {
  nome_empresa?: string;
  cpf_cpnj?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  telefone?: string;
};

export type ReceiptItem = {
  nome_produto: string;
  quant: number;
  valor: number;
  vr_total: number;
  unidade?: string;
};

export type ReceiptPayment = {
  label: string;
  valor: number;
};

export type ReceiptData = {
  company: ReceiptCompany;
  control: string;
  operator?: string;
  items: ReceiptItem[];
  payments: ReceiptPayment[];
  subtotal: number;
  desconto: number;
  total: number;
  troco: number;
  cliente?: { nome?: string; cpf_cnpj?: string };
  nfce?: {
    chave_nfe: string;
    numero?: number | null;
    serie?: number | null;
    protocolo?: string | null;
    qrcode_url?: string | null;
    ambiente?: 'homologacao' | 'producao' | null;
  } | null;
};

function buildPrinter(): { printer: ThermalPrinter; width: number } | { error: string } {
  const cfg = getConfig();
  const type = cfg.get('printer.type');
  const iface = cfg.get('printer.interface');
  const width = cfg.get('printer.width') ?? 48;
  if (!type || !iface) return { error: 'Impressora não configurada' };
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: iface,
    characterSet: CharacterSet.PC860_PORTUGUESE,
    removeSpecialCharacters: false,
    lineCharacter: '-',
    width,
    options: { timeout: 5000 },
  });
  return { printer, width };
}

function money(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function padLine(left: string, right: string, width: number): string {
  const spaces = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(spaces) + right;
}

export async function printSaleReceipt(data: ReceiptData, openDrawer = false): Promise<{ ok: boolean; error?: string }> {
  const built = buildPrinter();
  if ('error' in built) return { ok: false, error: built.error };
  const { printer, width } = built;

  try {
    const connected = await printer.isPrinterConnected();
    if (!connected) return { ok: false, error: 'Impressora não conectada' };

    printer.alignCenter();
    printer.bold(true);
    printer.setTextDoubleHeight();
    printer.println(data.company.nome_empresa ?? 'CUPOM DE VENDA');
    printer.setTextNormal();
    printer.bold(false);
    if (data.company.cpf_cpnj) printer.println(`CNPJ: ${data.company.cpf_cpnj}`);
    if (data.company.endereco) printer.println(data.company.endereco);
    const cityLine = [data.company.bairro, data.company.cidade, data.company.uf].filter(Boolean).join(' - ');
    if (cityLine) printer.println(cityLine);
    if (data.company.telefone) printer.println(`Tel: ${data.company.telefone}`);
    printer.drawLine();

    printer.alignLeft();
    printer.println(`CUPOM NÃO FISCAL`);
    printer.println(`Controle: ${data.control}`);
    printer.println(`Data: ${new Date().toLocaleString('pt-BR')}`);
    if (data.operator) printer.println(`Operador: ${data.operator}`);
    if (data.cliente?.nome) printer.println(`Cliente: ${data.cliente.nome}`);
    if (data.cliente?.cpf_cnpj) printer.println(`CPF/CNPJ: ${data.cliente.cpf_cnpj}`);
    printer.drawLine();

    printer.bold(true);
    printer.println(padLine('ITEM', 'VALOR', width));
    printer.bold(false);
    for (const it of data.items) {
      printer.println(it.nome_produto.slice(0, width));
      const detail = `${it.quant.toLocaleString('pt-BR')} ${it.unidade ?? 'UN'} x ${money(it.valor)}`;
      printer.println(padLine(`  ${detail}`, money(it.vr_total), width));
    }
    printer.drawLine();

    printer.println(padLine('Subtotal:', `R$ ${money(data.subtotal)}`, width));
    if (data.desconto > 0) printer.println(padLine('Desconto:', `R$ ${money(data.desconto)}`, width));
    printer.bold(true);
    printer.setTextDoubleHeight();
    printer.println(padLine('TOTAL:', `R$ ${money(data.total)}`, Math.floor(width / 2)));
    printer.setTextNormal();
    printer.bold(false);
    printer.drawLine();

    printer.println('FORMAS DE PAGAMENTO');
    for (const p of data.payments) {
      printer.println(padLine(p.label, `R$ ${money(p.valor)}`, width));
    }
    if (data.troco > 0) {
      printer.bold(true);
      printer.println(padLine('TROCO:', `R$ ${money(data.troco)}`, width));
      printer.bold(false);
    }
    printer.drawLine();

    // NFCe section — only if authorized
    if (data.nfce && data.nfce.chave_nfe) {
      printer.alignCenter();
      printer.bold(true);
      printer.println('NFC-e');
      printer.bold(false);
      if (data.nfce.numero && data.nfce.serie) {
        printer.println(`Nº ${data.nfce.numero}  Série ${data.nfce.serie}`);
      }
      // Chave em blocos de 4 dígitos
      const chaveFormatada = data.nfce.chave_nfe.replace(/(.{4})/g, '$1 ').trim();
      printer.println(chaveFormatada);
      if (data.nfce.protocolo) {
        printer.println(`Protocolo: ${data.nfce.protocolo}`);
      }
      if (data.nfce.ambiente === 'homologacao') {
        printer.bold(true);
        printer.println('*** SEM VALOR FISCAL - HOMOLOGACAO ***');
        printer.bold(false);
      }
      printer.newLine();
      if (data.nfce.qrcode_url) {
        printer.printQR(data.nfce.qrcode_url, { cellSize: 6, correction: 'M' });
      }
      printer.println('Consulta em www.nfce.fazenda.gov.br');
      printer.drawLine();
    }

    printer.alignCenter();
    printer.println('OBRIGADO PELA PREFERÊNCIA');
    printer.newLine();
    printer.cut();

    if (openDrawer) printer.openCashDrawer();
    await printer.execute();

    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
