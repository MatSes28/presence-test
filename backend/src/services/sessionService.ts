import { pool } from '../db/pool.js';

export interface AutoCreateResult {
  created: number;
  sessionIds: string[];
}

/** Create class sessions for today based on schedules (day_of_week). Idempotent: skips if session already exists for that schedule today. */
export async function autoCreateSessionsForToday(): Promise<AutoCreateResult> {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();
  const schedules = await pool.query(
    'SELECT id FROM schedules WHERE day_of_week = $1',
    [dayOfWeek]
  );
  const sessionIds: string[] = [];
  for (const row of schedules.rows) {
    const existing = await pool.query(
      `SELECT 1 FROM class_sessions WHERE schedule_id = $1 AND started_at >= $2 AND status = 'active'`,
      [row.id, todayStartIso]
    );
    if (existing.rows.length > 0) continue;
    const insert = await pool.query(
      `INSERT INTO class_sessions (schedule_id, status) VALUES ($1, 'active') RETURNING id`,
      [row.id]
    );
    sessionIds.push(insert.rows[0].id);
  }
  return { created: sessionIds.length, sessionIds };
}
