import { Router } from 'express';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getBehaviorConfig, getStudentAttendanceSummary } from '../services/behaviorService.js';
import { pool } from '../db/pool.js';

const router = Router();
router.use(authMiddleware);

router.get('/config', requireRoles('admin'), async (_req, res) => {
  const config = await getBehaviorConfig();
  res.json(config);
});

router.get('/student/:userId', requireRoles('admin', 'faculty'), async (req, res) => {
  const user = (req as AuthRequest).user;
  const { userId } = req.params;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const scheduleId = req.query.scheduleId as string | undefined;
  if (user.role !== 'admin') {
    const canSee = await pool.query(
      'SELECT 1 FROM schedules WHERE faculty_id = $1',
      [user.userId]
    );
    if (canSee.rows.length === 0) return res.status(403).json({ error: 'Forbidden' });
  }
  const summary = await getStudentAttendanceSummary(userId, { scheduleId, from, to });
  res.json(summary);
});

/** At-risk list: students with critical attendance (for dashboard). */
router.get('/at-risk', requireRoles('admin', 'faculty'), async (req, res) => {
  const user = (req as AuthRequest).user;
  const config = await getBehaviorConfig();
  const students = await pool.query(
    `SELECT id, full_name, email FROM users WHERE role = 'student' ORDER BY full_name`
  );
  const atRisk: Array<{ userId: string; full_name: string; email: string; attendanceRate: number; level: string }> = [];
  for (const s of students.rows) {
    const summary = await getStudentAttendanceSummary(s.id);
    if (summary.level === 'critical' && summary.totalSessions >= 1) {
      atRisk.push({
        userId: s.id,
        full_name: s.full_name,
        email: s.email,
        attendanceRate: summary.attendanceRate,
        level: summary.level,
      });
    }
  }
  res.json({ config: { criticalBelow: config.criticalBelow }, atRisk });
});

export default router;
