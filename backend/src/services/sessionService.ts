import { pool } from '../db/pool.js';
import { env } from '../config/env.js';

export interface AutoCreateResult {
  created: number;
  sessionIds: string[];
}

/**
 * Build a Date for the given calendar date at the given time string (HH:MM or HH:MM:SS).
 * Uses the same date's year/month/day so the session "starts" at schedule start_time.
 */
function atTimeOnDate(date: Date, timeStr: string): Date {
  const [h, m, s] = String(timeStr).split(':').map(Number);
  const d = new Date(date);
  d.setHours(h ?? 0, m ?? 0, s ?? 0, 0);
  return d;
}

/** Create class sessions for a given date based on schedules (day_of_week). Idempotent per schedule per date.
 * Each session's started_at is set to the schedule's start_time on that date so the IoT window is time-based.
 */
export async function autoCreateSessionsForDate(date: Date): Promise<AutoCreateResult> {
  const dayOfWeek = date.getDay();
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayStartIso = dayStart.toISOString();
  const schedules = await pool.query(
    'SELECT id, start_time, end_time FROM schedules WHERE day_of_week = $1',
    [dayOfWeek]
  );
  const sessionIds: string[] = [];
  for (const row of schedules.rows) {
    const existing = await pool.query(
      `SELECT 1 FROM class_sessions WHERE schedule_id = $1 AND started_at >= $2 AND status IN ('scheduled', 'active')`,
      [row.id, dayStartIso]
    );
    if (existing.rows.length > 0) continue;
    const startedAt = atTimeOnDate(dayStart, row.start_time);
    const insert = await pool.query(
      `INSERT INTO class_sessions (schedule_id, status, started_at) VALUES ($1, 'scheduled', $2) RETURNING id`,
      [row.id, startedAt.toISOString()]
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

/** Create scheduled sessions for a single schedule (today + next N days). Call when a schedule is created/updated so sessions exist immediately. */
export async function ensureSessionsForSchedule(scheduleId: string): Promise<AutoCreateResult> {
  const schedule = await pool.query(
    'SELECT id, start_time, end_time, day_of_week FROM schedules WHERE id = $1',
    [scheduleId]
  );
  if (schedule.rows.length === 0) return { created: 0, sessionIds: [] };
  const row = schedule.rows[0];
  const dayOfWeek = parseInt(String(row.day_of_week), 10);
  const sessionIds: string[] = [];
  const days = env.SESSION_CREATE_DAYS;
  for (let i = 0; i < Math.max(1, Math.min(days, 31)); i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    if (date.getDay() !== dayOfWeek) continue;
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayStartIso = dayStart.toISOString();
    const existing = await pool.query(
      `SELECT 1 FROM class_sessions WHERE schedule_id = $1 AND started_at >= $2 AND status IN ('scheduled', 'active')`,
      [scheduleId, dayStartIso]
    );
    if (existing.rows.length > 0) continue;
    const startedAt = atTimeOnDate(dayStart, row.start_time);
    const insert = await pool.query(
      `INSERT INTO class_sessions (schedule_id, status, started_at) VALUES ($1, 'scheduled', $2) RETURNING id`,
      [scheduleId, startedAt.toISOString()]
    );
    sessionIds.push(insert.rows[0].id);
  }
  return { created: sessionIds.length, sessionIds };
}
