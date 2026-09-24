import Database from 'better-sqlite3';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const source = process.env.DATABASE_PATH ?? 'data/keyspace.sqlite';
const destination = process.argv[2];
if (!destination || resolve(source) === resolve(destination) || existsSync(destination)) {
  throw new Error('Supply a new backup filename, different from the source. Existing files are never overwritten.');
}
mkdirSync(dirname(destination), { recursive: true });
const db = new Database(source, { readonly: true, fileMustExist: true });
try {
  await db.backup(destination);
  const copy = new Database(destination, { readonly: true });
  try {
    if (copy.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('Backup integrity failed');
    if (copy.pragma('foreign_key_check').length) throw new Error('Backup foreign keys failed');
    console.log(JSON.stringify({ backup: destination, integrity: 'ok', records: copy.prepare('SELECT count(*) AS count FROM records').get().count }));
  } finally { copy.close(); }
} catch (error) {
  if (existsSync(destination)) unlinkSync(destination);
  throw error;
} finally { db.close(); }
