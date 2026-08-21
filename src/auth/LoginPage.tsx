import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import pdvLoginImage from '@/assets/pdv_login.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BipaLogo } from '@/components/BipaLogo';
import { useAuth } from '@/stores/authStore';
import { useNavigate } from 'react-router-dom';
import { api, isElectron } from '@/lib/api';
import { isPdvOnly, parsePermissions } from '@/lib/permissions';

const STORAGE_KEY = 'pdv.rememberedLogin';

type Remembered = { login: string; password: string };

function loadRemembered(): Remembered | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Remembered;
    if (typeof parsed.login === 'string' && typeof parsed.password === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const [user, setUser] = useState('admin');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');
  const autoTried = useRef(false);

  useEffect(() => {
    if (isElectron()) {
      api.updater.getState().then((r) => setAppVersion(r.currentVersion)).catch(() => undefined);
    }
  }, []);

  const doLogin = async (u: string, p: string): Promise<boolean> => {
    setLoading(true);
    setErr(null);
    const r = await login(u.trim(), p);
    if (r.ok) {
      const session = useAuth.getState().session;
      const perms = session ? parsePermissions(session.menu_options) : null;
      if (session?.id_perfil !== 1 && perms && isPdvOnly(perms)) {
        navigate('/pdv', { replace: true });
      } else {
        navigate('/erp', { replace: true });
      }
      setLoading(false);
      return true;
    }
    setErr(r.error ?? 'Falha no login');
    setLoading(false);
    return false;
  };

  // On mount: if we have remembered credentials, prefill them. If the user
  // just logged out (skipAutoLogin flag), we only prefill and wait for Enter;
  // otherwise (fresh app start), we auto-submit.
  useEffect(() => {
    if (autoTried.current) return;
    const r = loadRemembered();
    if (!r) return;
    autoTried.current = true;
    setUser(r.login);
    setPass(r.password);
    setKeepSignedIn(true);

    let skip = false;
    try {
      skip = sessionStorage.getItem('pdv.skipAutoLogin') === '1';
      if (skip) sessionStorage.removeItem('pdv.skipAutoLogin');
    } catch {
      // no-op
    }
    if (skip) return;

    void doLogin(r.login, r.password).then((ok) => {
      // If saved credentials no longer work, drop them so the user sees the form clean next time.
      if (!ok) localStorage.removeItem(STORAGE_KEY);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await doLogin(user, pass);
    if (ok) {
      if (keepSignedIn) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ login: user.trim(), password: pass }));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Full-page background image */}
      <img
        src={pdvLoginImage}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />
      {/* Content */}
      <div className="relative min-h-screen w-full flex items-center justify-end px-6 sm:px-12 lg:px-24">
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md space-y-7 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl p-8 sm:p-10 text-white"
        >
          {/* Brand */}
          <BipaLogo size={44} wordmarkClassName="text-3xl text-white" />
          <div className="text-xs uppercase tracking-widest text-white/50 -mt-4">Sistema PDV</div>

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight leading-tight text-white">Bem-vindo de volta</h1>
            <p className="text-sm text-white/70">Entre para operar o caixa e o ERP.</p>
          </div>

          {/* Fields */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="user" className="text-xs uppercase tracking-wider text-white/60">Usuário</Label>
              <Input
                id="user"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                autoFocus
                className="h-11 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:bg-white/15"
                placeholder="admin"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pass" className="text-xs uppercase tracking-wider text-white/60">Senha</Label>
              <div className="relative">
                <Input
                  id="pass"
                  type={showPass ? 'text' : 'password'}
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  className="h-11 pr-11 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:bg-white/15"
                  placeholder="••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition"
                  aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-white/85">
              <input
                type="checkbox"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
                className="h-4 w-4 rounded border-white/30 bg-transparent accent-primary"
              />
              Manter sessão iniciada
            </label>
          </div>

          {err && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/20 border border-destructive/50 p-3 text-sm text-white">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-destructive" />
              {err}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full h-12 text-base bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg shadow-primary/40"
            disabled={loading || !user.trim() || !pass}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Entrar
          </Button>

          <p className="text-center text-[11px] text-white/50">
            Padrão: <code className="text-white/80">admin</code> / <code className="text-white/80">123456</code>
          </p>

          {appVersion && (
            <div className="text-center text-[10px] text-white/40 -mt-4 font-mono">
              Bipa v{appVersion}
            </div>
          )}
        </motion.form>

      </div>
    </div>
  );
}
