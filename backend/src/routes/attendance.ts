import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/by-session/:sessionId', requireRoles('admin', 'faculty'), async (req, res) => {
  const { sessionId } = req.params;
  const result = await pool.query(
    `SELECT ae.*, u.full_name, u.email
     FROM attendance_events ae
     JOIN users u ON u.id = ae.user_id
     WHERE ae.session_id = $1
     ORDER BY ae.recorded_at ASC`,
    [sessionId]
  );
  res.json(result.rows);
});

router.get('/reports/session/:sessionId', requireRoles('admin', 'faculty'), async (req, res) => {
  const { sessionId } = req.params;
  const session = await pool.query(
    `SELECT cs.*, s.subject, s.room FROM class_sessions cs JOIN schedules s ON s.id = cs.schedule_id WHERE cs.id = $1`,
    [sessionId]
  );
  if (session.rows.length === 0) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  const events = await pool.query(
    `SELECT ae.*, u.full_name, u.email FROM attendance_events ae JOIN users u ON u.id = ae.user_id WHERE ae.session_id = $1 ORDER BY ae.recorded_at`,
    [sessionId]
  );
  res.json({ session: session.rows[0], attendance: events.rows });
});

router.get('/reports/student/:userId', requireRoles('admin', 'faculty'), async (req, res) => {
  const { userId } = req.params;
  const from = (req.query.from as string) || new Date(0).toISOString();
  const to = (req.query.to as string) || new Date().toISOString();
  const result = await pool.query(
    `SELECT ae.*, cs.started_at AS session_start, s.subject, s.room
     FROM attendance_events ae
     JOIN class_sessions cs ON cs.id = ae.session_id
     JOIN schedules s ON s.id = cs.schedule_id
     WHERE ae.user_id = $1 AND ae.recorded_at BETWEEN $2 AND $3
     ORDER BY ae.recorded_at DESC`,
    [userId, from, to]
  );
  res.json(result.rows);
});

export default router;
