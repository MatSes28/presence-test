import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { autoCreateSessionsForNextDays } from '../services/sessionService.js';
import { env } from '../config/env.js';
import { audit, getClientIp } from '../services/auditService.js';

const router = Router();
router.use(authMiddleware);

const createSessionSchema = z.object({ schedule_id: z.string().uuid() });
const endSessionSchema = z.object({ session_id: z.string().uuid() });

function isAdmin(req: AuthRequest) {
  return req.user?.role === 'admin';
}

router.get('/', requireRoles('admin', 'faculty'), async (req, res) => {
  const user = (req as AuthRequest).user;
  const dateParam = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : null;
  const roomParam = typeof req.query.room === 'string' && req.query.room.trim() ? req.query.room.trim() : null;
  const subjectParam = typeof req.query.subject === 'string' && req.query.subject.trim() ? req.query.subject.trim() : null;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (isAdmin(req as AuthRequest)) {
    // no base filter
  } else {
    conditions.push(`s.faculty_id = $${idx}`);
    values.push(user.userId);
    idx++;
  }
  if (dateParam) {
    conditions.push(`(cs.started_at AT TIME ZONE 'UTC')::date = $${idx}::date`);
    values.push(dateParam);
    idx++;
  }
  if (roomParam) {
    conditions.push(`s.room ILIKE $${idx}`);
    values.push(`%${roomParam}%`);
    idx++;
  }
  if (subjectParam) {
    conditions.push(`s.subject ILIKE $${idx}`);
    values.push(`%${subjectParam}%`);
    idx++;
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(100);
  const limitPlaceholder = values.length;
  const result = await pool.query(
    `SELECT cs.*, s.subject, s.room, s.start_time, s.end_time, u.full_name AS faculty_name
     FROM class_sessions cs
     JOIN schedules s ON s.id = cs.schedule_id
     JOIN users u ON u.id = s.faculty_id
     ${whereClause}
     ORDER BY cs.started_at DESC
     LIMIT $${limitPlaceholder}`,
    values
  );
  res.json(result.rows);
});

router.get('/active', requireRoles('admin', 'faculty'), async (req, res) => {
  const user = (req as AuthRequest).user;
  if (isAdmin(req as AuthRequest)) {
    const result = await pool.query(
      `SELECT cs.*, s.subject, s.room, s.start_time, s.end_time, u.full_name AS faculty_name
       FROM class_sessions cs
       JOIN schedules s ON s.id = cs.schedule_id
       JOIN users u ON u.id = s.faculty_id
       WHERE cs.status = 'active'
       ORDER BY cs.started_at DESC`
    );
    return res.json(result.rows);
  }
  const result = await pool.query(
    `SELECT cs.*, s.subject, s.room, s.start_time, s.end_time, u.full_name AS faculty_name
     FROM class_sessions cs
     JOIN schedules s ON s.id = cs.schedule_id
     JOIN users u ON u.id = s.faculty_id
     WHERE cs.status = 'active' AND s.faculty_id = $1
     ORDER BY cs.started_at DESC`,
    [user.userId]
  );
  res.json(result.rows);
});

/** Format time string (HH:MM or HH:MM:SS) for display. */
function formatTime(timeStr: string): string {
  const [h, m] = String(timeStr).split(':').map(Number);
  const h12 = (h ?? 0) % 12 || 12;
  const ampm = (h ?? 0) < 12 ? 'AM' : 'PM';
  return `${h12}:${String(m ?? 0).padStart(2, '0')} ${ampm}`;
}

router.post('/start', requireRoles('admin', 'faculty'), async (req, res) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const user = (req as AuthRequest).user;
  const { schedule_id } = parsed.data;
  if (!isAdmin(req as AuthRequest)) {
    const check = await pool.query('SELECT id FROM schedules WHERE id = $1 AND faculty_id = $2', [schedule_id, user.userId]);
    if (check.rows.length === 0) {
      return res.status(403).json({ error: 'You can only start sessions for your own schedules' });
    }
  }
  const scheduleRow = await pool.query(
    'SELECT start_time, end_time, day_of_week FROM schedules WHERE id = $1',
    [schedule_id]
  );
  if (scheduleRow.rows.length === 0) {
    return res.status(404).json({ error: 'Schedule not found' });
  }
  const schedule = scheduleRow.rows[0];
  const startTime = schedule.start_time;
  const dayOfWeek = parseInt(String(schedule.day_of_week), 10);
  const now = new Date();
  const todayDay = now.getDay();

  // Manual start only for today's schedule (sessions are created automatically for the schedule's day).
  if (dayOfWeek !== todayDay) {
    return res.status(400).json({
      error: 'Schedule is not for today',
      message: 'Manual start is only for recovery on the same day. Sessions for this schedule are created and activated automatically on its scheduled day.',
    });
  }

  // Time-based rule: manual start only when the scheduled time has passed (by at least 1 minute).
  // So at 11:00 PM you cannot start an 11:00 PM schedule — it will auto-start. You cannot start any schedule whose start time is in the future or "now".
  if (todayDay === dayOfWeek && startTime) {
    const [sh, sm] = String(startTime).split(':').map(Number);
    const scheduledStartToday = new Date(now);
    scheduledStartToday.setHours(sh ?? 0, sm ?? 0, 0, 0);
    const oneMinuteMs = 60 * 1000;
    if (scheduledStartToday.getTime() > now.getTime()) {
      return res.status(400).json({
        error: 'Cannot start session early',
        message: `This class is scheduled for ${formatTime(startTime)}. It will start automatically at that time. You cannot start it early.`,
      });
    }
    if (now.getTime() - scheduledStartToday.getTime() < oneMinuteMs) {
      return res.status(400).json({
        error: 'Session will start automatically',
        message: `This class is at ${formatTime(startTime)}. It will start automatically within a minute. You cannot start it manually.`,
      });
    }
  }

  // One session per schedule per day: if any session exists for this schedule today (scheduled, active, or ended), reject.
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const existing = await pool.query(
    `SELECT 1 FROM class_sessions WHERE schedule_id = $1 AND started_at >= $2`,
    [schedule_id, todayStart.toISOString()]
  );
  if (existing.rows.length > 0) {
    return res.status(400).json({
      error: 'Session already exists for today',
      message: `A session for this schedule already exists for today (scheduled, active, or completed). Sessions are time-based and automatic; you cannot create a second session for the same day.`,
    });
  }

  let startedAt = now;
  if (startTime && todayDay === dayOfWeek) {
    const [h, m, s] = String(startTime).split(':').map(Number);
    const todayStartTime = new Date(now);
    todayStartTime.setHours(h ?? 0, m ?? 0, s ?? 0, 0);
    if (todayStartTime.getTime() <= now.getTime()) startedAt = todayStartTime;
  }
  const insert = await pool.query(
    `INSERT INTO class_sessions (schedule_id, status, started_at) VALUES ($1, 'active', $2) RETURNING *`,
    [schedule_id, startedAt.toISOString()]
  );
  const sessionRow = insert.rows[0];
  await audit({
    actorId: user.userId,
    actorEmail: user.email,
    action: 'session_start',
    resourceType: 'session',
    resourceId: sessionRow?.id,
    details: { schedule_id },
    ipAddress: getClientIp(req),
  });
  res.status(201).json(sessionRow);
});

router.post('/end', requireRoles('admin', 'faculty'), async (req, res) => {
  const parsed = endSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const user = (req as AuthRequest).user;
  if (!isAdmin(req as AuthRequest)) {
    const check = await pool.query(
      'SELECT cs.id FROM class_sessions cs JOIN schedules s ON s.id = cs.schedule_id WHERE cs.id = $1 AND s.faculty_id = $2',
      [parsed.data.session_id, user.userId]
    );
    if (check.rows.length === 0) {
      return res.status(403).json({ error: 'You can only end your own sessions' });
    }
  }
  await pool.query(
    `UPDATE class_sessions SET status = 'ended', ended_at = NOW() WHERE id = $1 AND status = 'active' RETURNING *`,
    [parsed.data.session_id]
  );
  const updated = await pool.query(`SELECT * FROM class_sessions WHERE id = $1`, [
    parsed.data.session_id,
  ]);
  if (updated.rows.length === 0) {
    res.status(404).json({ error: 'Session not found or already ended' });
    return;
  }
  await audit({
    actorId: user.userId,
    actorEmail: user.email,
    action: 'session_end',
    resourceType: 'session',
    resourceId: parsed.data.session_id,
    ipAddress: getClientIp(req),
  });
  res.json(updated.rows[0]);
});

const autoCreateSchema = z.object({ days: z.number().int().min(1).max(31).optional() });
/** Create sessions for next N days (default: env SESSION_CREATE_DAYS or 1). Admin only. Idempotent. */
router.post('/auto-create', requireRoles('admin'), async (req, res) => {
  const parsed = autoCreateSchema.safeParse(req.body ?? {});
  const days = parsed.success && parsed.data.days != null ? parsed.data.days : env.SESSION_CREATE_DAYS;
  const result = await autoCreateSessionsForNextDays(days);
  res.json(result);
});

export default router;
