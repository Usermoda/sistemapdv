import { create } from 'zustand';
import { api } from '@/lib/api';
import { parsePermissions, type PermissionKey, type PermissionMap } from '@/lib/permissions';

export type Session = {
  id: number;
  login: string;
  id_perfil: number;
  nome_perfil: string;
  menu_options: string;
  loginAt: number;
};

type AuthState = {
  session: Session | null;
  permissions: PermissionMap | null;
  loading: boolean;
  hydrate: () => Promise<void>;
  login: (login: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  can: (key: PermissionKey) => boolean;
};

function permsFrom(session: Session | null): PermissionMap | null {
  if (!session) return null;
  // Admin (id_perfil = 1) always has full access
  if (session.id_perfil === 1) return parsePermissions('SSSSSSSSSSS'.repeat(20));
  return parsePermissions(session.menu_options);
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  permissions: null,
  loading: true,

  hydrate: async () => {
    try {
      const cur = await api.auth.current();
      set({ session: cur, permissions: permsFrom(cur), loading: false });
    } catch {
      set({ session: null, permissions: null, loading: false });
    }
  },

  login: async (login, password) => {
    const r = await api.auth.login({ login, password });
    if (r.ok && r.session) {
      set({ session: r.session, permissions: permsFrom(r.session) });
      return { ok: true };
    }
    return { ok: false, error: r.error ?? 'Falha no login' };
  },

  logout: async () => {
    await api.auth.logout();
    set({ session: null, permissions: null });
  },

  can: (key: PermissionKey) => {
    const p = get().permissions;
    if (!p) return false;
    return !!p[key];
  },
}));
