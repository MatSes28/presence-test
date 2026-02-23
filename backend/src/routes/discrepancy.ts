import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', requireRoles('admin', 'faculty'), async (req, res) => {
  const user = (req as AuthRequest).user;
  const sessionId = req.query.sessionId as string | undefined;
  try {
    let result;
    if (sessionId) {
      if (user.role !== 'admin') {
        const check = await pool.query(
          'SELECT 1 FROM class_sessions cs JOIN schedules s ON s.id = cs.schedule_id WHERE cs.id = $1 AND s.faculty_id = $2',
          [sessionId, user.userId]
        );
        if (check.rows.length === 0) return res.status(403).json({ error: 'Access denied' });
      }
      result = await pool.query(
        `SELECT df.*, u.full_name AS user_name FROM discrepancy_flags df
         LEFT JOIN users u ON u.id = df.user_id WHERE df.session_id = $1 ORDER BY df.created_at DESC`,
        [sessionId]
      );
    } else {
      if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
      result = await pool.query(
        `SELECT df.*, u.full_name AS user_name, cs.started_at, s.subject
         FROM discrepancy_flags df
         LEFT JOIN users u ON u.id = df.user_id
         JOIN class_sessions cs ON cs.id = df.session_id
         JOIN schedules s ON s.id = cs.schedule_id
         ORDER BY df.created_at DESC LIMIT 200`
      );
    }
    res.json(result.rows);
  } catch {
    res.json([]);
  }
});

export default router;
