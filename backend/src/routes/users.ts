import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
  role: z.enum(['admin', 'faculty', 'student']),
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
    `SELECT u.id, u.email, u.full_name, u.created_at, r.card_uid
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
  const insert = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, role, full_name, created_at`,
    [parsed.data.email, hash, parsed.data.full_name, parsed.data.role]
  );
  res.status(201).json(insert.rows[0]);
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

export default router;
