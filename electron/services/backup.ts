import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { getConfig } from './config';

function bundledMysqldumpPath(): string | null {
  const base = path.join(app.getPath('userData'), 'mariadb');
  const dirs = fs.existsSync(base) ? fs.readdirSync(base).filter((d) => d.startsWith('mariadb-')) : [];
  for (const d of dirs) {
    const p = path.join(base, d, 'bin', 'mysqldump.exe');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function bundledMysqlPath(): string | null {
  const base = path.join(app.getPath('userData'), 'mariadb');
  const dirs = fs.existsSync(base) ? fs.readdirSync(base).filter((d) => d.startsWith('mariadb-')) : [];
  for (const d of dirs) {
    const p = path.join(base, d, 'bin', 'mysql.exe');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function getBackupDir(): string {
  const custom = getConfig().get('backup.customPath');
  if (custom && custom.trim()) return custom;
  return path.join(app.getPath('userData'), 'backups');
}

export type BackupFile = { name: string; path: string; size: number; created: number };

export function listBackups(): BackupFile[] {
  const dir = getBackupDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql') || f.endsWith('.sql.gz'))
    .map((f) => {
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      return { name: f, path: full, size: st.size, created: st.mtimeMs };
    })
    .sort((a, b) => b.created - a.created);
}

export async function runBackup(): Promise<{ ok: boolean; path?: string; error?: string; size?: number }> {
  const cfg = getConfig();
  const host = cfg.get('db.host');
  const port = cfg.get('db.port') ?? 3306;
  const user = cfg.get('db.user') ?? 'root';
  const password = cfg.get('db.password') ?? '';
  const database = cfg.get('db.database');
  if (!host || !database) return { ok: false, error: 'Banco não configurado' };

  const mysqldump = bundledMysqldumpPath() ?? 'mysqldump';
  const dir = getBackupDir();
  fs.mkdirSync(dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `${database}_${stamp}.sql`);

  const args = [
    `--host=${host}`,
    `--port=${port}`,
    `--user=${user}`,
    ...(password ? [`--password=${password}`] : []),
    '--single-transaction',
    '--routines',
    '--triggers',
    '--default-character-set=utf8mb4',
    database,
  ];

  return await new Promise<{ ok: boolean; path?: string; error?: string; size?: number }>((resolve) => {
    const out = fs.createWriteStream(file);
    const child = spawn(mysqldump, args, { windowsHide: true });
    let stderr = '';
    child.stdout.pipe(out);
    child.stderr.on('data', (b: Buffer) => { stderr += b.toString('utf8'); });
    child.on('error', (e) => {
      out.close();
      try { fs.unlinkSync(file); } catch { /* ignore */ }
      resolve({ ok: false, error: e.message });
    });
    child.on('close', (code) => {
      out.close();
      if (code !== 0) {
        try { fs.unlinkSync(file); } catch { /* ignore */ }
        resolve({ ok: false, error: stderr || `mysqldump exit ${code}` });
      } else {
        const st = fs.statSync(file);
        cfg.set('backup.lastRun', new Date().toISOString());
        cleanupOldBackups();
        resolve({ ok: true, path: file, size: st.size });
      }
    });
  });
}

export async function restoreBackup(backupPath: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = getConfig();
  const host = cfg.get('db.host');
  const port = cfg.get('db.port') ?? 3306;
  const user = cfg.get('db.user') ?? 'root';
  const password = cfg.get('db.password') ?? '';
  const database = cfg.get('db.database');
  if (!host || !database) return { ok: false, error: 'Banco não configurado' };
  if (!fs.existsSync(backupPath)) return { ok: false, error: 'Arquivo não encontrado' };

  const mysql = bundledMysqlPath() ?? 'mysql';

  const args = [
    `--host=${host}`,
    `--port=${port}`,
    `--user=${user}`,
    ...(password ? [`--password=${password}`] : []),
    '--default-character-set=utf8mb4',
    database,
  ];

  return await new Promise((resolve) => {
    const child = spawn(mysql, args, { windowsHide: true });
    const input = fs.createReadStream(backupPath);
    input.pipe(child.stdin);
    let stderr = '';
    child.stderr.on('data', (b: Buffer) => { stderr += b.toString('utf8'); });
    child.on('error', (e) => resolve({ ok: false, error: e.message }));
    child.on('close', (code) => {
      if (code !== 0) resolve({ ok: false, error: stderr || `mysql exit ${code}` });
      else resolve({ ok: true });
    });
  });
}

export function deleteBackup(name: string): void {
  const dir = getBackupDir();
  const full = path.join(dir, name);
  if (full.startsWith(dir) && fs.existsSync(full)) fs.unlinkSync(full);
}

function cleanupOldBackups(): void {
  const cfg = getConfig();
  const keep = cfg.get('backup.keepDays') ?? 30;
  if (!keep || keep <= 0) return;
  const cutoff = Date.now() - keep * 24 * 60 * 60 * 1000;
  for (const b of listBackups()) {
    if (b.created < cutoff) {
      try { fs.unlinkSync(b.path); } catch { /* ignore */ }
    }
  }
}

let scheduleTimer: NodeJS.Timeout | null = null;

function schedule(): void {
  if (scheduleTimer) {
    clearTimeout(scheduleTimer);
    scheduleTimer = null;
  }
  const cfg = getConfig();
  if (!cfg.get('backup.enabled')) return;

  const hour = cfg.get('backup.hour') ?? 3;
  const minute = cfg.get('backup.minute') ?? 0;
  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const delay = next.getTime() - now.getTime();

  scheduleTimer = setTimeout(async () => {
    try { await runBackup(); } catch (e) { console.error('Backup auto error:', e); }
    schedule(); // reschedule for next day
  }, delay);
}

export function startBackupScheduler(): void {
  schedule();
}

export function refreshBackupScheduler(): void {
  schedule();
}
