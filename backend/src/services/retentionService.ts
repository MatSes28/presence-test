import { pool } from '../db/pool.js';

/**
 * Purge audit_log entries older than the given number of days (world-class retention).
 */
export async function purgeOldAuditLog(daysOld: number): Promise<{ deleted: number }> {
  if (daysOld <= 0) return { deleted: 0 };
  const r = await pool.query(
    `DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
    [daysOld]
  );
  return { deleted: r.rowCount ?? 0 };
}
