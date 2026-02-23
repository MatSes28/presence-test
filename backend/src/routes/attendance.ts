import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { audit, getClientIp } from '../services/auditService.js';

const router = Router();
router.use(authMiddleware);

async function canAccessSession(req: AuthRequest, sessionId: string): Promise<boolean> {
  const user = req.user;
  if (user?.role === 'admin') return true;
  const row = await pool.query(
    'SELECT 1 FROM class_sessions cs JOIN schedules s ON s.id = cs.schedule_id WHERE cs.id = $1 AND s.faculty_id = $2',
    [sessionId, user?.userId]
  );
  return row.rows.length > 0;
}

router.get('/session/:sessionId/stats', requireRoles('admin', 'faculty'), async (req, res) => {
  const { sessionId } = req.params;
  if (!(await canAccessSession(req as AuthRequest, sessionId))) {
    return res.status(403).json({ error: 'Access denied to this session' });
  }
  const counts = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE COALESCE(attendance_status, 'present') = 'present') AS present_count,
       COUNT(*) FILTER (WHERE attendance_status = 'late') AS late_count,
       COUNT(*) AS total_recorded
     FROM attendance_events WHERE session_id = $1`,
    [sessionId]
  );
  const row = counts.rows[0];
  res.json({
    presentCount: parseInt(String(row?.present_count ?? 0), 10),
    lateCount: parseInt(String(row?.late_count ?? 0), 10),
    totalRecorded: parseInt(String(row?.total_recorded ?? 0), 10),
  });
});

router.get('/by-session/:sessionId', requireRoles('admin', 'faculty'), async (req, res) => {
  const { sessionId } = req.params;
  if (!(await canAccessSession(req as AuthRequest, sessionId))) {
    return res.status(403).json({ error: 'Access denied to this session' });
  }
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
  const authReq = req as AuthRequest;
  if (!(await canAccessSession(authReq, sessionId))) {
    return res.status(403).json({ error: 'Access denied to this session' });
  }
  await audit({
    actorId: authReq.user?.userId,
    actorEmail: authReq.user?.email,
    action: 'attendance_report_view',
    resourceType: 'session',
    resourceId: sessionId,
    ipAddress: getClientIp(req),
  });
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

router.get('/reports/session/:sessionId/export', requireRoles('admin', 'faculty'), async (req, res) => {
  const { sessionId } = req.params;
  const authReq = req as AuthRequest;
  const format = (req.query.format as string) || 'csv';
  if (!(await canAccessSession(authReq, sessionId))) {
    return res.status(403).json({ error: 'Access denied to this session' });
  }
  const session = await pool.query(
    `SELECT cs.*, s.subject, s.room FROM class_sessions cs JOIN schedules s ON s.id = cs.schedule_id WHERE cs.id = $1`,
    [sessionId]
  );
  if (session.rows.length === 0) {
    return res.status(404).json({ error: 'Session not found' });
  }
  const events = await pool.query(
    `SELECT ae.recorded_at, u.full_name, u.email, ae.distance_cm, ae.status
     FROM attendance_events ae JOIN users u ON u.id = ae.user_id
     WHERE ae.session_id = $1 ORDER BY ae.recorded_at`,
    [sessionId]
  );
  const s = session.rows[0];
  if (format === 'csv') {
    await audit({
      actorId: authReq.user?.userId,
      actorEmail: authReq.user?.email,
      action: 'attendance_export_csv',
      resourceType: 'session',
      resourceId: sessionId,
      details: { format: 'csv', rowCount: events.rows.length },
      ipAddress: getClientIp(req),
    });
    const header = 'Name,Email,Recorded At,Distance (cm),Status';
    const rows = events.rows.map(
      (r: { full_name: string; email: string; recorded_at: string; distance_cm: number | null; status: string }) =>
        [r.full_name, r.email, r.recorded_at, r.distance_cm ?? '', r.status].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
    );
    const csv = [header, ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${s.subject.replace(/\s+/g, '-')}-${s.room}-${s.id.slice(0, 8)}.csv"`);
    res.send('\uFEFF' + csv);
    return;
  }
  res.status(400).json({ error: 'Unsupported format. Use ?format=csv' });
});

router.get('/reports/student/:userId', requireRoles('admin', 'faculty'), async (req, res) => {
  const user = (req as AuthRequest).user;
  const { userId } = req.params;
  const from = (req.query.from as string) || new Date(0).toISOString();
  const to = (req.query.to as string) || new Date().toISOString();
  if (user.role !== 'admin') {
    const result = await pool.query(
      `SELECT ae.*, cs.started_at AS session_start, s.subject, s.room
       FROM attendance_events ae
       JOIN class_sessions cs ON cs.id = ae.session_id
       JOIN schedules s ON s.id = cs.schedule_id
       WHERE ae.user_id = $1 AND ae.recorded_at BETWEEN $2 AND $3 AND s.faculty_id = $4
       ORDER BY ae.recorded_at DESC`,
      [userId, from, to, user.userId]
    );
    return res.json(result.rows);
  }
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
