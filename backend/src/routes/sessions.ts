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
  const insert = await pool.query(
    `INSERT INTO class_sessions (schedule_id, status) VALUES ($1, 'active') RETURNING *`,
    [schedule_id]
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
