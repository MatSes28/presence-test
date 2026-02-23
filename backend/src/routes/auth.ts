import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import type { UserRole } from '../types/index.js';
import { authMiddleware } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { audit, getClientIp } from '../services/auditService.js';

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().min(1),
  role: z.enum(['admin', 'faculty', 'student']),
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;
  const result = await pool.query(
    'SELECT id, email, password_hash, role, full_name FROM users WHERE email = $1',
    [email]
  );
  if (result.rows.length === 0) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions
  );
  res.cookie(env.SESSION_COOKIE_NAME, token, COOKIE_OPTIONS);
  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'auth_login',
    details: { role: user.role },
    ipAddress: getClientIp(req),
  });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
    },
  });
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const { email, password, full_name, role } = parsed.data;
  const password_hash = await bcrypt.hash(password, 10);
  try {
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role, full_name, created_at`,
      [email, password_hash, full_name, role]
    );
    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions
    );
    res.cookie(env.SESSION_COOKIE_NAME, token, COOKIE_OPTIONS);
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
    });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === '23505') {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    throw e;
  }
});

/** Get current user from session cookie or Bearer token. */
router.get('/me', authMiddleware, async (req, res) => {
  const { user } = req as AuthRequest;
  const r = await pool.query(
    'SELECT id, email, role, full_name FROM users WHERE id = $1',
    [user.userId]
  );
  if (r.rows.length === 0) {
    res.status(401).json({ error: 'User not found' });
    return;
  }
  const row = r.rows[0];
  res.json({
    user: {
      id: row.id,
      email: row.email,
      role: row.role,
      full_name: row.full_name,
    },
  });
});

/** Clear session cookie. Optionally audit if user was logged in (cookie present). */
router.post('/logout', async (req, res) => {
  const token = req.cookies?.[env.SESSION_COOKIE_NAME];
  if (token) {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { userId?: string; email?: string };
      if (payload?.userId) {
        await audit({
          actorId: payload.userId,
          actorEmail: payload.email ?? undefined,
          action: 'auth_logout',
          ipAddress: getClientIp(req),
        });
      }
    } catch {
      // ignore invalid/expired token
    }
  }
  res.clearCookie(env.SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  res.json({ ok: true });
});

export default router;
