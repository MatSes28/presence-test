import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const createSessionSchema = z.object({ schedule_id: z.string().uuid() });
const endSessionSchema = z.object({ session_id: z.string().uuid() });

router.get('/', requireRoles('admin', 'faculty'), async (req, res) => {
  const result = await pool.query(
    `SELECT cs.*, s.subject, s.room, s.start_time, s.end_time, u.full_name AS faculty_name
     FROM class_sessions cs
     JOIN schedules s ON s.id = cs.schedule_id
     JOIN users u ON u.id = s.faculty_id
     ORDER BY cs.started_at DESC
     LIMIT 100`
  );
  res.json(result.rows);
});

router.get('/active', requireRoles('admin', 'faculty'), async (req, res) => {
  const result = await pool.query(
    `SELECT cs.*, s.subject, s.room, s.start_time, s.end_time, u.full_name AS faculty_name
     FROM class_sessions cs
     JOIN schedules s ON s.id = cs.schedule_id
     JOIN users u ON u.id = s.faculty_id
     WHERE cs.status = 'active'
     ORDER BY cs.started_at DESC`
  );
  res.json(result.rows);
});

router.post('/start', requireRoles('admin', 'faculty'), async (req, res) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const { schedule_id } = parsed.data;
  const insert = await pool.query(
    `INSERT INTO class_sessions (schedule_id, status) VALUES ($1, 'active') RETURNING *`,
    [schedule_id]
  );
  res.status(201).json(insert.rows[0]);
});

router.post('/end', requireRoles('admin', 'faculty'), async (req, res) => {
  const parsed = endSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
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
  res.json(updated.rows[0]);
});

export default router;
