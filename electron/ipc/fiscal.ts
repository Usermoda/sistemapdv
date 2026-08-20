import { ipcMain } from 'electron';
import { getConfig } from '../services/config';
import { emitSaleAsNFCe, pollNFCeStatus, cancelNFCeByRef, getNFCeByVenda, retryPending, listPendingEmissions } from '../services/fiscal/emitter';

type FiscalSettings = {
  enabled: boolean;
  provider: 'focusnfe' | 'none';
  ambiente: 'homologacao' | 'producao';
  uf: string;
  serie: number;
  proximo_numero: number;
  regime_tributario: 1 | 2 | 3;
  cnae: string;
  ncm_padrao: string;
  cfop_padrao: string;
  cst_csosn_padrao: string;
  origem_padrao: number;
  focusnfe_token: string;
  focusnfe_csc_id: string;
  focusnfe_csc_token: string;
};

export function registerFiscalHandlers(): void {
  ipcMain.handle('fiscal:get-settings', async (): Promise<FiscalSettings> => {
    const c = getConfig();
    return {
      enabled: !!c.get('fiscal.enabled'),
      provider: (c.get('fiscal.provider') as 'focusnfe' | 'none') ?? 'none',
      ambiente: (c.get('fiscal.ambiente') as 'homologacao' | 'producao') ?? 'homologacao',
      uf: c.get('fiscal.uf') ?? 'SP',
      serie: c.get('fiscal.serie') ?? 1,
      proximo_numero: c.get('fiscal.proximo_numero') ?? 1,
      regime_tributario: (c.get('fiscal.regime_tributario') as 1 | 2 | 3) ?? 1,
      cnae: c.get('fiscal.cnae') ?? '',
      ncm_padrao: c.get('fiscal.ncm_padrao') ?? '',
      cfop_padrao: c.get('fiscal.cfop_padrao') ?? '5102',
      cst_csosn_padrao: c.get('fiscal.cst_csosn_padrao') ?? '102',
      origem_padrao: c.get('fiscal.origem_padrao') ?? 0,
      focusnfe_token: c.get('fiscal.focusnfe.token') ?? '',
      focusnfe_csc_id: c.get('fiscal.focusnfe.csc_id') ?? '',
      focusnfe_csc_token: c.get('fiscal.focusnfe.csc_token') ?? '',
    };
  });

  ipcMain.handle('fiscal:save-settings', async (_e, s: FiscalSettings) => {
    const c = getConfig();
    c.set('fiscal.enabled', s.enabled);
    c.set('fiscal.provider', s.provider);
    c.set('fiscal.ambiente', s.ambiente);
    c.set('fiscal.uf', s.uf);
    c.set('fiscal.serie', s.serie);
    c.set('fiscal.proximo_numero', s.proximo_numero);
    c.set('fiscal.regime_tributario', s.regime_tributario);
    c.set('fiscal.cnae', s.cnae);
    c.set('fiscal.ncm_padrao', s.ncm_padrao);
    c.set('fiscal.cfop_padrao', s.cfop_padrao);
    c.set('fiscal.cst_csosn_padrao', s.cst_csosn_padrao);
    c.set('fiscal.origem_padrao', s.origem_padrao);
    c.set('fiscal.focusnfe.token', s.focusnfe_token);
    c.set('fiscal.focusnfe.csc_id', s.focusnfe_csc_id);
    c.set('fiscal.focusnfe.csc_token', s.focusnfe_csc_token);
    return { ok: true };
  });

  ipcMain.handle('fiscal:emit-nfce', async (_e, idVenda: number) => emitSaleAsNFCe(idVenda));

  ipcMain.handle('fiscal:poll-nfce', async (_e, ref: string) => pollNFCeStatus(ref));

  ipcMain.handle('fiscal:cancel-nfce', async (_e, args: { ref: string; justificativa: string }) =>
    cancelNFCeByRef(args.ref, args.justificativa)
  );

  ipcMain.handle('fiscal:get-nfce-by-venda', async (_e, idVenda: number) => getNFCeByVenda(idVenda));

  ipcMain.handle('fiscal:list-pending', async () => listPendingEmissions());

  ipcMain.handle('fiscal:retry-pending', async () => retryPending(50));

  ipcMain.handle('fiscal:retry-one', async (_e, idVenda: number) => emitSaleAsNFCe(idVenda));
}
