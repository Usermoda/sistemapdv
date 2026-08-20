import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2, Lock, LogIn, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/stores/authStore';
import { useNavigate } from 'react-router-dom';
import { isPdvOnly, parsePermissions } from '@/lib/permissions';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const [user, setUser] = useState('admin');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const r = await login(user.trim(), pass);
    if (r.ok) {
      const session = useAuth.getState().session;
      const perms = session ? parsePermissions(session.menu_options) : null;
      // Admin (id_perfil 1) or non-PDV-only → ERP
      if (session?.id_perfil !== 1 && perms && isPdvOnly(perms)) {
        navigate('/pdv', { replace: true });
      } else {
        navigate('/erp', { replace: true });
      }
    } else setErr(r.error ?? 'Falha no login');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-8">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md space-y-6 rounded-2xl border border-white/5 bg-card/70 backdrop-blur-md p-8 shadow-2xl"
      >
        <div className="text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/40 mb-4">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Sistema PDV</h1>
          <p className="text-sm text-muted-foreground mt-1">Faça login para continuar</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-foreground">Usuário</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={user} onChange={(e) => setUser(e.target.value)} autoFocus className="pl-9 h-12" placeholder="admin" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} className="pl-9 h-12" placeholder="••••••" />
            </div>
          </div>
        </div>

        {err && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {err}
          </div>
        )}

        <Button type="submit" size="lg" className="w-full h-12" disabled={loading || !user.trim() || !pass}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          Entrar
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Usuário padrão: <code className="text-foreground">admin</code> / senha <code className="text-foreground">123456</code>
        </p>
      </motion.form>
    </div>
  );
}
