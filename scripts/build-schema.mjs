import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const srcPath = path.join(root, 'db-source.sql');
const outPath = path.join(root, 'db', 'schema.sql');

// Read as latin1 so acentos são recuperados corretamente
const raw = fs.readFileSync(srcPath, 'latin1');

// Header
let out = '';
out += '-- Schema do Sistema PDV\n';
out += '-- Convertido para UTF-8 / InnoDB / utf8mb4\n\n';
out += "SET NAMES utf8mb4;\n";
out += "SET FOREIGN_KEY_CHECKS=0;\n";
out += "SET sql_mode = '';\n\n";

// Modernize: add ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 to CREATE TABLE endings
// The original ends each CREATE TABLE with `) ;`
let modernized = raw.replace(/\)\s*;\s*(?=\n|$)/g, (match, offset, full) => {
  // Only alter blocks that are CREATE TABLE (walk backwards to find nearest CREATE/INSERT)
  const before = full.slice(Math.max(0, offset - 4000), offset);
  const lastCreate = before.lastIndexOf('CREATE TABLE');
  const lastInsert = before.lastIndexOf('INSERT');
  const lastLock = before.lastIndexOf('LOCK TABLES');
  if (lastCreate > lastInsert && lastCreate > lastLock) {
    return ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;';
  }
  return match;
});

// The SQL uses double(12,4) etc. MySQL 8+ deprecates DOUBLE(M,D) — remove precision
modernized = modernized.replace(/\bdouble\s*\(\s*\d+\s*,\s*\d+\s*\)/gi, 'DOUBLE');

// int(4) unsigned zerofill etc. — MySQL 8 warns on display width, keep for compatibility
// (será aceito com apenas warnings)

// Fix defaults like default '0000-00-00' which fail under strict mode — but we SET sql_mode = ''
// so it's ok.

// Skip the LOCK TABLES / UNLOCK TABLES — they're advisory but keep them; safe.

// Skip weird /*!32312 IF NOT EXISTS*/ directive — keep it (mysql ignores unknown versions)

out += modernized;

// Seed extras: default profile + admin login
out += '\n\n-- Seeds adicionais\n';
out += "INSERT IGNORE INTO cad_login_perfil (id_perfil, nome_perfil, menu_options) VALUES (1, 'ADMINISTRADOR', REPEAT('S', 250));\n";
out += "INSERT IGNORE INTO cad_login (id, login, senha, id_perfil, inativo) VALUES (1, 'admin', '123456', 1, 0);\n";
out += "INSERT IGNORE INTO cad_moedas (id, moeda, cotacao) VALUES (1, 'BRL', 1.0000);\n";
out += "INSERT IGNORE INTO cad_produtos_tipo (id, nome_tipo) VALUES (1, 'PADRÃO');\n";

out += '\nSET FOREIGN_KEY_CHECKS=1;\n';

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out, 'utf8');
console.log('Schema written to', outPath, '-', out.length, 'bytes');
