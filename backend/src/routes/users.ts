import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { audit, getClientIp } from '../services/auditService.js';

const router = Router();
router.use(authMiddleware);

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
  role: z.enum(['admin', 'faculty', 'student']),
  guardian_email: z.string().email().optional(),
});

const rfidSchema = z.object({
  card_uid: z.string().min(1),
  user_id: z.string().uuid(),
});

router.get('/', requireRoles('admin', 'faculty'), async (req, res) => {
  const result = await pool.query(
    'SELECT id, email, role, full_name, created_at FROM users ORDER BY full_name'
  );
  res.json(result.rows);
});

router.get('/students', requireRoles('admin', 'faculty'), async (req, res) => {
  const result = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.guardian_email, u.created_at, r.card_uid
     FROM users u
     LEFT JOIN rfid_cards r ON r.user_id = u.id AND r.is_active = true
     WHERE u.role = 'student'
     ORDER BY u.full_name`
  );
  res.json(result.rows);
});

router.post('/', requireRoles('admin'), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const hash = await bcrypt.hash(parsed.data.password, 10);
  const guardian = parsed.data.guardian_email ?? null;
  try {
    const insert = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, guardian_email) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role, full_name, created_at`,
      [parsed.data.email, hash, parsed.data.full_name, parsed.data.role, guardian]
    );
    const newUser = insert.rows[0];
    await audit({
      actorId: (req as AuthRequest).user?.userId,
      actorEmail: (req as AuthRequest).user?.email,
      action: 'user_create',
      resourceType: 'user',
      resourceId: newUser?.id,
      details: { email: parsed.data.email, role: parsed.data.role },
      ipAddress: getClientIp(req),
    });
    res.status(201).json(newUser);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === '23505') {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    throw e;
  }
});

router.post('/rfid', requireRoles('admin', 'faculty'), async (req, res) => {
  const parsed = rfidSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  await pool.query(
    `INSERT INTO rfid_cards (card_uid, user_id) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET card_uid = $1, is_active = true`,
    [parsed.data.card_uid, parsed.data.user_id]
  );
  const row = await pool.query(
    'SELECT * FROM rfid_cards WHERE user_id = $1',
    [parsed.data.user_id]
  );
  res.status(201).json(row.rows[0]);
});

const updateGuardianSchema = z.object({ guardian_email: z.string().email().nullable() });
router.patch('/:id', requireRoles('admin'), async (req, res) => {
  const parsed = updateGuardianSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const result = await pool.query(
    'UPDATE users SET guardian_email = $1, updated_at = NOW() WHERE id = $2 AND role = $3 RETURNING id, email, full_name, guardian_email',
    [parsed.data.guardian_email ?? null, req.params.id, 'student']
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'User not found or not a student' });
    return;
  }
  res.json(result.rows[0]);
});

export default router;
