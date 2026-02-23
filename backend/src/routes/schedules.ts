import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const createScheduleSchema = z.object({
  subject: z.string().min(1),
  room: z.string().min(1),
  start_time: z.string().regex(/^\d{2}:\d{2}/),
  end_time: z.string().regex(/^\d{2}:\d{2}/),
  day_of_week: z.number().min(0).max(6),
  faculty_id: z.string().uuid(),
});

router.get('/', requireRoles('admin', 'faculty'), async (req, res) => {
  const user = (req as { user: { userId: string; role: string } }).user;
  if (user.role === 'admin') {
    const result = await pool.query(
      `SELECT s.*, u.full_name AS faculty_name FROM schedules s JOIN users u ON u.id = s.faculty_id ORDER BY s.day_of_week, s.start_time`
    );
    return res.json(result.rows);
  }
  const result = await pool.query(
    `SELECT s.*, u.full_name AS faculty_name FROM schedules s JOIN users u ON u.id = s.faculty_id WHERE s.faculty_id = $1 ORDER BY s.day_of_week, s.start_time`,
    [user.userId]
  );
  res.json(result.rows);
});

router.post('/', requireRoles('admin'), async (req, res) => {
  const parsed = createScheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const insert = await pool.query(
    `INSERT INTO schedules (subject, room, start_time, end_time, day_of_week, faculty_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      parsed.data.subject,
      parsed.data.room,
      parsed.data.start_time,
      parsed.data.end_time,
      parsed.data.day_of_week,
      parsed.data.faculty_id,
    ]
  );
  res.status(201).json(insert.rows[0]);
});

export default router;
