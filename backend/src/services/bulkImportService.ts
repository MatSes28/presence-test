import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';

export interface BulkUserRow {
  email: string;
  full_name: string;
  role: 'admin' | 'faculty' | 'student';
  guardian_email?: string;
  card_uid?: string;
  password?: string;
}

export interface BulkImportResult {
  created: number;
  skipped: number;
  errors: { row: number; email?: string; message: string }[];
}

/**
 * Parse CSV line (handles quoted fields with commas).
 */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === ',' && !inQuotes) || (c === '\n' && !inQuotes)) {
      out.push(current.trim());
      current = '';
      if (c === '\n') break;
    } else {
      current += c;
    }
  }
  out.push(current.trim());
  return out;
}

/**
 * Parse CSV text into rows. Expected columns: email, full_name, role, guardian_email (optional), card_uid (optional).
 * First row can be header (email, full_name, role, ...); if first cell is "email" we skip it.
 */
export function parseUsersCsv(csvText: string): BulkUserRow[] {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const rows: BulkUserRow[] = [];
  const first = parseCsvLine(lines[0]);
  const isHeader = first[0]?.toLowerCase() === 'email' || first[0]?.toLowerCase() === 'email address';
  const start = isHeader ? 1 : 0;
  const roleSet = new Set(['admin', 'faculty', 'student']);
  for (let i = start; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const email = (cells[0] ?? '').trim();
    const full_name = (cells[1] ?? '').trim();
    const role = ((cells[2] ?? '').trim().toLowerCase()) as 'admin' | 'faculty' | 'student';
    const guardian_email = (cells[3] ?? '').trim() || undefined;
    const card_uid = (cells[4] ?? '').trim() || undefined;
    const password = (cells[5] ?? '').trim() || undefined;
    if (!email || !full_name) continue;
    if (!roleSet.has(role)) continue;
    rows.push({
      email,
      full_name,
      role,
      guardian_email: guardian_email && guardian_email.length > 0 ? guardian_email : undefined,
      card_uid: card_uid && card_uid.length > 0 ? card_uid : undefined,
      password: password && password.length >= 6 ? password : undefined,
    });
  }
  return rows;
}

/**
 * Import users (and optionally link RFID) from parsed rows. Idempotent: existing email = skip.
 */
export async function bulkImportUsers(rows: BulkUserRow[]): Promise<BulkImportResult> {
  const result: BulkImportResult = { created: 0, skipped: 0, errors: [] };
  const studentHash = await bcrypt.hash('no-login-student-' + crypto.randomUUID(), 10);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      result.errors.push({ row: rowNum, email: row.email, message: 'Invalid email' });
      continue;
    }
    if (!row.full_name?.trim()) {
      result.errors.push({ row: rowNum, email: row.email, message: 'Missing full name' });
      continue;
    }
    if (!['admin', 'faculty', 'student'].includes(row.role)) {
      result.errors.push({ row: rowNum, email: row.email, message: 'Invalid role' });
      continue;
    }
    const passwordHash =
      row.role === 'student'
        ? studentHash
        : row.password && row.password.length >= 6
          ? await bcrypt.hash(row.password, 10)
          : await bcrypt.hash('temp-change-me-' + crypto.randomUUID(), 10);
    const guardian = row.guardian_email && row.role === 'student' ? row.guardian_email : null;
    try {
      const insert = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, role, guardian_email)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [row.email, passwordHash, row.full_name, row.role, guardian]
      );
      if (insert.rowCount === 0) {
        result.skipped += 1;
        if (row.card_uid) {
          const user = await pool.query('SELECT id FROM users WHERE email = $1', [row.email]);
          if (user.rows[0]) {
            await pool.query(
              `INSERT INTO rfid_cards (card_uid, user_id) VALUES ($1, $2)
               ON CONFLICT (user_id) DO UPDATE SET card_uid = $1, is_active = true`,
              [row.card_uid, user.rows[0].id]
            );
          }
        }
        continue;
      }
      result.created += 1;
      const userId = insert.rows[0].id;
      if (row.card_uid) {
        await pool.query(
          `INSERT INTO rfid_cards (card_uid, user_id) VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET card_uid = $1, is_active = true`,
          [row.card_uid, userId]
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      result.errors.push({ row: rowNum, email: row.email, message: msg });
    }
  }
  return result;
}
