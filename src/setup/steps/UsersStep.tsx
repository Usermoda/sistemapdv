import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2, Plus, Shield, Trash2, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { PROFILE_TEMPLATES, serializePermissions } from '@/lib/permissions';

type User = { id: number; login: string; id_perfil: number; nome_perfil: string; inativo: number };
type Profile = { id_perfil: number; nome_perfil: string; menu_options: string; users: number };

export function UsersStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLogin, setNewLogin] = useState('');
  const [newSenha, setNewSenha] = useState('');
  const [newProfile, setNewProfile] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const [u, p] = await Promise.all([api.auth.listUsers(), api.auth.listProfiles()]);
      setUsers(u as User[]);
      setProfiles(p as Profile[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  // Cria perfis dos templates que ainda não existem (idempotente).
  const seedTemplates = async () => {
    setCreating(true);
    let created = 0;
    for (const t of PROFILE_TEMPLATES) {
      if (!profiles.some((p) => p.nome_perfil.toUpperCase() === t.name.toUpperCase())) {
        try {
          await api.auth.saveProfile({
            nome_perfil: t.name,
            menu_options: serializePermissions(t.perms),
          });
          created++;
        } catch {
          // continua o loop
        }
      }
    }
    await load();
    setCreating(false);
    if (created > 0) toast.success(`${created} perfis criados`);
    else toast.message('Todos os perfis padrão já estavam criados');
  };

  const createUser = async () => {
    if (!newLogin.trim() || !newSenha.trim() || !newProfile) {
      toast.error('Preencha login, senha e perfil');
      return;
    }
    setCreating(true);
    try {
      await api.auth.saveUser({
        login: newLogin.trim(),
        senha: newSenha,
        id_perfil: newProfile,
      });
      setNewLogin('');
      setNewSenha('');
      setNewProfile(null);
      await load();
      toast.success(`Usuário ${newLogin.trim()} criado`);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setCreating(false);
  };

  const removeUser = async (u: User) => {
    if (u.id === 1) {
      toast.error('O usuário administrador padrão não pode ser removido.');
      return;
    }
    if (!confirm(`Remover o usuário "${u.login}"?`)) return;
    try {
      await api.auth.saveUser({ id: u.id, login: u.login, id_perfil: u.id_perfil, inativo: 1 });
      await load();
      toast.success('Usuário desativado');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-4"
        >
          <Users className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">Usuários e perfis</span>
        </motion.div>
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mb-3">
          Quem vai operar?
        </h1>
        <p className="text-muted-foreground max-w-xl">
          Você pode criar usuários agora ou depois em Configurações. Comece criando os perfis
          padrão (Caixa, Gerente, Estoquista, Vendedor) para reutilizar em vários usuários.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Perfis */}
          <div className="rounded-xl border border-white/5 bg-black/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" /> Perfis
                </div>
                <div className="text-xs text-muted-foreground">
                  {profiles.length} perfil{profiles.length !== 1 ? 'es' : ''} cadastrado{profiles.length !== 1 ? 's' : ''}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={seedTemplates} disabled={creating}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Criar perfis padrão
              </Button>
            </div>
            {profiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {profiles.map((p) => (
                  <span
                    key={p.id_perfil}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-white/5"
                  >
                    <Shield className="w-3 h-3 text-primary" />
                    {p.nome_perfil}
                    <span className="text-muted-foreground">({p.users})</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Usuários */}
          <div className="rounded-xl border border-white/5 overflow-hidden bg-black/20">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black/30 text-xs uppercase text-muted-foreground">
                  <th className="text-left px-4 py-2.5">Login</th>
                  <th className="text-left px-4 py-2.5">Perfil</th>
                  <th className="w-14"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-white/5">
                    <td className="px-4 py-2 font-medium">{u.login}</td>
                    <td className="px-4 py-2 text-muted-foreground">{u.nome_perfil}</td>
                    <td className="px-2 py-2 text-right">
                      {u.id !== 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeUser(u)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Criar novo */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="text-sm font-semibold flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" /> Adicionar usuário
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Login</Label>
                <Input value={newLogin} onChange={(e) => setNewLogin(e.target.value)} placeholder="ex.: joao" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Senha</Label>
                <Input type="password" value={newSenha} onChange={(e) => setNewSenha(e.target.value)} placeholder="mín. 4 caracteres" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Perfil</Label>
                <Select
                  value={newProfile ? String(newProfile) : ''}
                  onValueChange={(v) => setNewProfile(Number(v))}
                >
                  <SelectTrigger><SelectValue placeholder={profiles.length ? 'Selecione' : 'Crie um perfil primeiro'} /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id_perfil} value={String(p.id_perfil)}>
                        {p.nome_perfil}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={createUser} disabled={creating || !newLogin.trim() || !newSenha.trim() || !newProfile}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Criar usuário
              </Button>
            </div>
          </div>
        </>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <Button onClick={onNext} size="lg">
          Continuar <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
