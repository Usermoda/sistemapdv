import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, isElectron } from '@/lib/api';
import { AlertTriangle, Loader2 } from 'lucide-react';

export function SetupGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isElectron()) {
      setError('Este app deve ser aberto pela janela do Electron. Rode "npm run dev" e aguarde a janela abrir.');
      setLoading(false);
      return;
    }
    api
      .getSetupStatus()
      .then((s) => {
        if (!cancelled) {
          setComplete(s.setupComplete);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-warning/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-warning" />
          </div>
          <h1 className="text-xl font-semibold">Ambiente incorreto</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!complete) return <Navigate to="/setup/welcome" replace />;
  return <>{children}</>;
}
