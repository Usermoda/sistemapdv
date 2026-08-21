import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, type UpdaterState } from '@/lib/api';
import { toast } from 'sonner';

/**
 * Banner discreto no rodapé quando uma atualização foi baixada e está pronta
 * para aplicar. Comportamento silencioso: o download já rodou em background
 * automaticamente; aqui só sinalizamos ao usuário e oferecemos "aplicar agora"
 * (opcional — se ele não clicar, aplica sozinho ao fechar o app).
 *
 * Estados `available` e `downloading` são silenciosos por padrão.
 * `error` e `downloaded` são visíveis (o primeiro como toast, o segundo como
 * banner persistente).
 */
export function UpdateBanner() {
  const [state, setState] = useState<UpdaterState>({ phase: 'idle' });
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastPhaseRef = useRef<UpdaterState['phase']>('idle');

  useEffect(() => {
    api.updater.getState().then((r) => setState(r.state)).catch(() => undefined);
    const off = api.updater.onState((s) => setState(s));
    return off;
  }, []);

  // Toasts informativos discretos nas transições silenciosas
  useEffect(() => {
    if (state.phase === lastPhaseRef.current) return;
    lastPhaseRef.current = state.phase;

    if (state.phase === 'available') {
      toast.message(`Baixando atualização v${state.info.version} em segundo plano`, {
        duration: 4000,
        icon: <Download className="w-4 h-4" />,
      });
    } else if (state.phase === 'error') {
      // Só mostra erro se for de verificação/download, não de "sem update"
      toast.error(`Falha ao atualizar: ${state.message}`, { duration: 6000 });
    }
  }, [state]);

  const install = async () => {
    setBusy(true);
    const r = await api.updater.install();
    if (!r.ok) {
      toast.error(r.error ?? 'Falha ao aplicar');
      setBusy(false);
    }
  };

  // Só o "downloaded" mostra o banner persistente
  if (dismissed || state.phase !== 'downloaded') return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 20 }}
        className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-primary/30 bg-card shadow-2xl p-3"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
            <RefreshCw className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold leading-tight">
              Atualização v{state.info.version} pronta
            </div>
            <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              Aplica automaticamente ao fechar o Bipa.
            </div>
          </div>
          <Button size="sm" onClick={install} disabled={busy} className="flex-shrink-0">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Aplicar agora
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground p-1 flex-shrink-0"
            aria-label="Fechar"
            title="Ignorar (aplica ao fechar o app)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
