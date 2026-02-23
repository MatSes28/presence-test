import { pool } from '../db/pool.js';

export interface AutoCreateResult {
  created: number;
  sessionIds: string[];
}

/** Create class sessions for a given date based on schedules (day_of_week). Idempotent per schedule per date. */
export async function autoCreateSessionsForDate(date: Date): Promise<AutoCreateResult> {
  const dayOfWeek = date.getDay();
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayStartIso = dayStart.toISOString();
  const schedules = await pool.query(
    'SELECT id FROM schedules WHERE day_of_week = $1',
    [dayOfWeek]
  );
  const sessionIds: string[] = [];
  for (const row of schedules.rows) {
    const existing = await pool.query(
      `SELECT 1 FROM class_sessions WHERE schedule_id = $1 AND started_at >= $2 AND status = 'active'`,
      [row.id, dayStartIso]
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

/** Create class sessions for today. */
export async function autoCreateSessionsForToday(): Promise<AutoCreateResult> {
  return autoCreateSessionsForDate(new Date());
}

/** Create class sessions for the next N days (including today). Default 1 = today only. */
export async function autoCreateSessionsForNextDays(days: number): Promise<{ created: number; sessionIds: string[] }> {
  let totalCreated = 0;
  const allIds: string[] = [];
  const d = new Date();
  for (let i = 0; i < Math.max(1, Math.min(days, 31)); i++) {
    const result = await autoCreateSessionsForDate(new Date(d));
    totalCreated += result.created;
    allIds.push(...result.sessionIds);
    d.setDate(d.getDate() + 1);
  }
  return { created: totalCreated, sessionIds: allIds };
}
