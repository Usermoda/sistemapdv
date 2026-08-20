import bcrypt from 'bcryptjs';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getPool } from './db';

export type Session = {
  id: number;
  login: string;
  id_perfil: number;
  nome_perfil: string;
  menu_options: string;
  loginAt: number;
};

let currentSession: Session | null = null;

const BCRYPT_PREFIX = /^\$2[ayb]\$/;

async function findUser(login: string) {
  const pool = await getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.*, p.nome_perfil, p.menu_options
     FROM cad_login u LEFT JOIN cad_login_perfil p ON p.id_perfil = u.id_perfil
     WHERE u.login = ? AND (u.inativo IS NULL OR u.inativo = 0)
     LIMIT 1`,
    [login]
  );
  return rows[0] as
    | {
        id: number;
        login: string;
        senha: string;
        id_perfil: number;
        nome_perfil: string;
        menu_options: string;
      }
    | undefined;
}

/**
 * Authenticates a user. Supports "upgrade on login": if the stored password is
 * plain text (not bcrypt), it's compared literally then re-saved as bcrypt.
 */
export async function login(loginName: string, password: string): Promise<Session | null> {
  const user = await findUser(loginName);
  if (!user) return null;

  const stored = user.senha ?? '';
  const isHashed = BCRYPT_PREFIX.test(stored);

  let matches = false;
  if (isHashed) {
    matches = await bcrypt.compare(password, stored);
  } else {
    matches = stored === password;
    if (matches) {
      // upgrade in place
      const hash = await bcrypt.hash(password, 10);
      const pool = await getPool();
      await pool.query('UPDATE cad_login SET senha = ? WHERE id = ?', [hash, user.id]);
    }
  }

  if (!matches) return null;

  currentSession = {
    id: user.id,
    login: user.login,
    id_perfil: user.id_perfil,
    nome_perfil: user.nome_perfil ?? '',
    menu_options: user.menu_options ?? '',
    loginAt: Date.now(),
  };
  return currentSession;
}

export function logout(): void {
  currentSession = null;
}

export function getSession(): Session | null {
  return currentSession;
}

export function requireSession(): Session {
  if (!currentSession) throw new Error('Não autenticado');
  return currentSession;
}

export async function changePassword(userId: number, newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 4) throw new Error('A nova senha deve ter pelo menos 4 caracteres');
  const hash = await bcrypt.hash(newPassword, 10);
  const pool = await getPool();
  await pool.query('UPDATE cad_login SET senha = ? WHERE id = ?', [hash, userId]);
}

export async function listUsers() {
  const pool = await getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.id, u.login, u.id_perfil, u.inativo, p.nome_perfil
     FROM cad_login u LEFT JOIN cad_login_perfil p ON p.id_perfil = u.id_perfil
     ORDER BY u.login ASC`
  );
  return rows;
}

export async function listProfiles() {
  const pool = await getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT p.id_perfil, p.nome_perfil, p.menu_options,
            (SELECT COUNT(*) FROM cad_login u WHERE u.id_perfil = p.id_perfil) AS users
     FROM cad_login_perfil p ORDER BY p.id_perfil ASC`
  );
  return rows;
}

export async function saveProfile(data: { id_perfil?: number; nome_perfil: string; menu_options?: string }) {
  const pool = await getPool();
  const menu = data.menu_options ?? 'S'.repeat(250);
  if (data.id_perfil) {
    await pool.query('UPDATE cad_login_perfil SET nome_perfil = ?, menu_options = ? WHERE id_perfil = ?', [
      data.nome_perfil,
      menu,
      data.id_perfil,
    ]);
    return { id_perfil: data.id_perfil };
  }
  const [r] = await pool.query<ResultSetHeader>(
    'INSERT INTO cad_login_perfil (nome_perfil, menu_options) VALUES (?, ?)',
    [data.nome_perfil, menu]
  );
  return { id_perfil: r.insertId };
}

export async function deleteProfile(id_perfil: number) {
  const pool = await getPool();
  // Prevent deleting the default admin profile (id=1) or profiles in use
  if (id_perfil === 1) throw new Error('O perfil ADMINISTRADOR não pode ser removido');
  const [[cnt]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS c FROM cad_login WHERE id_perfil = ?', [id_perfil]);
  if ((cnt as { c: number }).c > 0) {
    throw new Error('Este perfil está em uso por usuários. Reatribua-os antes de remover.');
  }
  await pool.query('DELETE FROM cad_login_perfil WHERE id_perfil = ?', [id_perfil]);
  return { ok: true };
}

export async function saveUser(data: { id?: number; login: string; id_perfil: number; senha?: string; inativo?: number }) {
  const pool = await getPool();
  if (data.id) {
    // Update without touching password unless provided
    if (data.senha) {
      const hash = await bcrypt.hash(data.senha, 10);
      await pool.query('UPDATE cad_login SET login = ?, id_perfil = ?, senha = ?, inativo = ? WHERE id = ?', [
        data.login,
        data.id_perfil,
        hash,
        data.inativo ?? 0,
        data.id,
      ]);
    } else {
      await pool.query('UPDATE cad_login SET login = ?, id_perfil = ?, inativo = ? WHERE id = ?', [
        data.login,
        data.id_perfil,
        data.inativo ?? 0,
        data.id,
      ]);
    }
    return { id: data.id };
  }
  if (!data.senha) throw new Error('Senha obrigatória para novo usuário');
  const hash = await bcrypt.hash(data.senha, 10);
  const [r] = await pool.query<ResultSetHeader>(
    'INSERT INTO cad_login (login, senha, id_perfil, inativo) VALUES (?, ?, ?, ?)',
    [data.login, hash, data.id_perfil, data.inativo ?? 0]
  );
  return { id: r.insertId };
}
