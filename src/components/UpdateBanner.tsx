import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, type UpdaterState } from '@/lib/api';
import { toast } from 'sonner';

/**
 * Banner discreto no rodapé da tela quando há atualização disponível ou
 * baixada. Escuta `updater:state` continuamente.
 */
export function UpdateBanner() {
  const [state, setState] = useState<UpdaterState>({ phase: 'idle' });
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Estado inicial (o main pode já ter emitido antes do banner montar)
    api.updater.getState().then((r) => setState(r.state)).catch(() => undefined);
    const off = api.updater.onState((s) => setState(s));
    return off;
  }, []);

  const download = async () => {
    setBusy(true);
    const r = await api.updater.download();
    if (!r.ok) toast.error(r.error ?? 'Falha ao baixar');
    setBusy(false);
  };

  const install = async () => {
    setBusy(true);
    const r = await api.updater.install();
    if (!r.ok) {
      toast.error(r.error ?? 'Falha ao aplicar');
      setBusy(false);
    }
    // Se ok, o app está fechando — não precisa mais tratar
  };

  if (dismissed) return null;

  const show =
    state.phase === 'available' ||
    state.phase === 'downloading' ||
    state.phase === 'downloaded';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 20 }}
          className="fixed bottom-4 right-4 z-50 max-w-md rounded-xl border border-primary/30 bg-card shadow-2xl p-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
              {state.phase === 'downloading' ? (
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              ) : state.phase === 'downloaded' ? (
                <RefreshCw className="w-5 h-5 text-primary" />
              ) : (
                <Download className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {state.phase === 'available' && (
                <>
                  <div className="text-sm font-semibold">
                    Nova versão disponível — {state.info.version}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Baixar agora em segundo plano? Você continua trabalhando normalmente.
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={download} disabled={busy}>
                      <Download className="w-3.5 h-3.5" /> Baixar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
                      Mais tarde
                    </Button>
                  </div>
                </>
              )}
              {state.phase === 'downloading' && (
                <>
                  <div className="text-sm font-semibold">
                    Baixando atualização...
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                      style={{ width: `${state.percent.toFixed(1)}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                    {state.percent.toFixed(0)}% · {(state.bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s
                  </div>
                </>
              )}
              {state.phase === 'downloaded' && (
                <>
                  <div className="text-sm font-semibold">
                    Atualização {state.info.version} pronta!
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    O Bipa vai fechar e reabrir para aplicar. Salve o que estiver fazendo.
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={install} disabled={busy}>
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Reiniciar e aplicar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
                      Mais tarde
                    </Button>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-muted-foreground hover:text-foreground p-1"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
