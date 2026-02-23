import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { audit, getClientIp } from '../services/auditService.js';
import { ensureSessionsForSchedule } from '../services/sessionService.js';

const router = Router();
router.use(authMiddleware);

const createScheduleSchema = z.object({
  subject: z.string().min(1),
  room: z.string().min(1),
  start_time: z.string().regex(/^\d{2}:\d{2}/),
  end_time: z.string().regex(/^\d{2}:\d{2}/),
  day_of_week: z.number().min(0).max(6),
  faculty_id: z.string().uuid(),
  classroom_id: z.string().uuid().optional(),
  subject_id: z.string().uuid().optional(),
  device_id: z.string().max(100).optional(),
});

router.get('/', requireRoles('admin', 'faculty'), async (req, res) => {
  const user = (req as import('../middleware/auth.js').AuthRequest).user;
  const base = `SELECT s.*, u.full_name AS faculty_name,
    cl.name AS classroom_name, sub.code AS subject_code, sub.name AS subject_name,
    iot.device_id AS iot_device_id, iot.name AS iot_device_name
    FROM schedules s
    JOIN users u ON u.id = s.faculty_id
    LEFT JOIN classrooms cl ON cl.id = s.classroom_id
    LEFT JOIN subjects sub ON sub.id = s.subject_id
    LEFT JOIN iot_devices iot ON iot.device_id = s.device_id`;
  if (user.role === 'admin') {
    const result = await pool.query(`${base} ORDER BY s.day_of_week, s.start_time`);
    return res.json(result.rows);
  }
  const result = await pool.query(
    `${base} WHERE s.faculty_id = $1 ORDER BY s.day_of_week, s.start_time`,
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
  const { start_time, end_time } = parsed.data;
  const [sh, sm] = String(start_time).split(':').map(Number);
  const [eh, em] = String(end_time).split(':').map(Number);
  const startMins = (sh ?? 0) * 60 + (sm ?? 0);
  const endMins = (eh ?? 0) * 60 + (em ?? 0);
  if (endMins <= startMins) {
    res.status(400).json({ error: 'End time must be after start time' });
    return;
  }
  const insert = await pool.query(
    `INSERT INTO schedules (subject, room, start_time, end_time, day_of_week, faculty_id, classroom_id, subject_id, device_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      parsed.data.subject,
      parsed.data.room,
      parsed.data.start_time,
      parsed.data.end_time,
      parsed.data.day_of_week,
      parsed.data.faculty_id,
      parsed.data.classroom_id ?? null,
      parsed.data.subject_id ?? null,
      parsed.data.device_id ?? null,
    ]
  );
  const row = insert.rows[0];
  try {
    await ensureSessionsForSchedule(row.id);
  } catch (e) {
    console.error('[schedules] ensureSessionsForSchedule failed:', e);
  }
  await audit({
    actorId: (req as AuthRequest).user?.userId,
    actorEmail: (req as AuthRequest).user?.email,
    action: 'schedule_create',
    resourceType: 'schedule',
    resourceId: row?.id,
    details: { subject: parsed.data.subject, room: parsed.data.room },
    ipAddress: getClientIp(req),
  });
  res.status(201).json(row);
});

export default router;
