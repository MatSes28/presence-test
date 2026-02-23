#!/usr/bin/env node
/**
 * Database backup script for CLIRDEC:PRESENCE (world-class ops).
 * Uses pg_dump; DATABASE_URL must be set. Output: stdout (pipe to file or gzip).
 * Requires pg_dump on PATH (PostgreSQL client tools).
 *
 * Example:
 *   node scripts/db-backup.js > backup-$(date +%Y%m%d-%H%M%S).sql
 *   node scripts/db-backup.js | gzip > backup-$(date +%Y%m%d-%H%M%S).sql.gz
 */
import { spawn } from 'child_process';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

// Parse postgres://user:password@host:port/dbname (password may contain : or @)
function parsePgUrl(u) {
  const at = u.indexOf('@');
  if (at === -1) return null;
  const left = u.slice(u.indexOf('://') + 3, at);
  const right = u.slice(at + 1);
  const colon = left.indexOf(':');
  const user = colon === -1 ? left : left.slice(0, colon);
  const password = colon === -1 ? '' : left.slice(colon + 1);
  const slash = right.indexOf('/');
  const hostPort = slash === -1 ? right : right.slice(0, slash);
  const db = slash === -1 ? 'clirdec' : right.slice(slash + 1).replace(/\?.*$/, '');
  const [host, port] = hostPort.includes(':') ? hostPort.split(':') : [hostPort, '5432'];
  return { user, password, host, port, db };
}

try {
  const p = parsePgUrl(url);
  if (!p) throw new Error('Invalid DATABASE_URL');
  const env = { ...process.env, PGHOST: p.host, PGPORT: p.port, PGUSER: p.user || 'postgres', PGDATABASE: p.db };
  if (p.password) env.PGPASSWORD = p.password;
  const proc = spawn('pg_dump', ['-F', 'p', '--no-owner', '--no-acl'], { stdio: ['ignore', 'pipe', 'inherit'], env });
  proc.stdout.pipe(process.stdout);
  proc.on('close', (code) => process.exit(code ?? 0));
} catch (e) {
  console.error('Failed to run pg_dump. Ensure DATABASE_URL is set and pg_dump is on PATH.', e);
  process.exit(1);
}
