import crypto from 'crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { audit, getClientIp } from '../services/auditService.js';
import { parseUsersCsv, bulkImportUsers } from '../services/bulkImportService.js';
import { deleteUser } from '../services/userDeletionService.js';

const router = Router();
router.use(authMiddleware);

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional(),
  full_name: z.string().min(1),
  role: z.enum(['admin', 'faculty', 'student']),
  guardian_email: z.string().email().optional(),
}).refine((data) => data.role === 'student' || (data.password && data.password.length >= 6), {
  message: 'Password (min 6 characters) is required for admin and faculty',
  path: ['password'],
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
  // Students don't log in (RFID only); use a placeholder hash so they can't sign in. Faculty/admin need a password.
  const password =
    parsed.data.role === 'student'
      ? null
      : (parsed.data.password && parsed.data.password.length >= 6 ? parsed.data.password : null);
  const hash = password
    ? await bcrypt.hash(password, 10)
    : await bcrypt.hash('no-login-student-' + crypto.randomUUID(), 10);
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

const importSchema = z.object({ csv: z.string().min(1) });
router.post('/import', requireRoles('admin'), async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const rows = parseUsersCsv(parsed.data.csv);
  if (rows.length === 0) {
    res.status(400).json({ error: 'No valid rows. CSV format: email, full_name, role, guardian_email (optional), card_uid (optional), password (optional for admin/faculty)' });
    return;
  }
  const result = await bulkImportUsers(rows);
  await audit({
    actorId: (req as AuthRequest).user?.userId,
    actorEmail: (req as AuthRequest).user?.email,
    action: 'user_bulk_import',
    resourceType: 'user',
    details: { created: result.created, skipped: result.skipped, errors: result.errors.length },
    ipAddress: getClientIp(req),
  });
  res.json(result);
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

/** Generate a time-limited link for a student to view their own attendance (admin only). */
router.post('/:id/attendance-link', requireRoles('admin'), async (req, res) => {
  const userId = req.params.id;
  const r = await pool.query('SELECT id, full_name, role FROM users WHERE id = $1', [userId]);
  if (r.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (r.rows[0].role !== 'student') {
    res.status(400).json({ error: 'Attendance link is for students only' });
    return;
  }
  const token = jwt.sign(
    { userId, purpose: 'student_attendance_view' },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  const baseUrl = (req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http') + '://' + (req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost');
  const url = `${baseUrl}/my-attendance?token=${encodeURIComponent(token)}`;
  res.json({ url, token, expiresIn: '7d' });
});

router.delete('/:id', requireRoles('admin'), async (req, res) => {
  const targetId = req.params.id;
  const selfId = (req as AuthRequest).user?.userId;
  if (targetId === selfId) {
    res.status(400).json({ error: 'Cannot delete your own account' });
    return;
  }
  const result = await deleteUser(targetId);
  if (!result.ok) {
    res.status(400).json({ error: result.reason });
    return;
  }
  await audit({
    actorId: selfId,
    actorEmail: (req as AuthRequest).user?.email,
    action: 'user_delete',
    resourceType: 'user',
    resourceId: targetId,
    details: { deleted_user_id: targetId },
    ipAddress: getClientIp(req),
  });
  res.status(204).send();
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
