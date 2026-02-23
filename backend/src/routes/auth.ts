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
import * as oidcService from '../services/oidcService.js';
import { sendPasswordResetEmail } from '../services/notificationService.js';

const router = Router();

const OIDC_STATE_COOKIE = 'oidc_state';
const OIDC_STATE_MAX_AGE = 10 * 60 * 1000; // 10 min

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

const forgotPasswordSchema = z.object({ email: z.string().email() });
const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6),
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

/** Public: request password reset. Only for admin/faculty (students don't log in). Sends email if user exists and email is configured. */
router.post('/forgot-password', async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const { email } = parsed.data;
  const result = await pool.query(
    'SELECT id, email, full_name, role FROM users WHERE email = $1 AND role IN ($2, $3)',
    [email, 'admin', 'faculty']
  );
  // Always respond the same to avoid email enumeration
  const ok = { message: 'If an account exists for this email, you will receive a reset link shortly.' };
  if (result.rows.length === 0) {
    res.json(ok);
    return;
  }
  const user = result.rows[0];
  if (!env.PASSWORD_RESET_APP_URL) {
    res.json(ok);
    return;
  }
  const resetToken = jwt.sign(
    { userId: user.id, email: user.email, purpose: 'password_reset' },
    env.JWT_SECRET,
    { expiresIn: '1h' } as jwt.SignOptions
  );
  const resetLink = `${env.PASSWORD_RESET_APP_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const sent = await sendPasswordResetEmail({
    email: user.email,
    fullName: user.full_name,
    resetLink,
  });
  if (sent) {
    await audit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'auth_password_reset_requested',
      ipAddress: getClientIp(req),
    });
  }
  res.json(ok);
});

/** Public: set new password using token from email. */
router.post('/reset-password', async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const { token, newPassword } = parsed.data;
  let payload: { userId?: string; email?: string; purpose?: string };
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as typeof payload;
  } catch {
    res.status(400).json({ error: 'Invalid or expired reset link. Request a new one.' });
    return;
  }
  if (payload?.purpose !== 'password_reset' || !payload.userId) {
    res.status(400).json({ error: 'Invalid reset link.' });
    return;
  }
  const password_hash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
    password_hash,
    payload.userId,
  ]);
  await audit({
    actorId: payload.userId,
    actorEmail: payload.email ?? undefined,
    action: 'auth_password_reset',
    ipAddress: getClientIp(req),
  });
  res.json({ message: 'Password updated. You can sign in with your new password.' });
});

/** Public: whether SSO is configured (for showing "Sign in with SSO" on login page). */
router.get('/config', (_req, res) => {
  res.json({
    ssoEnabled: !!(env.OIDC_ISSUER && env.OIDC_CLIENT_ID && env.OIDC_REDIRECT_URI),
  });
});

/** SSO: redirect to IdP login. Requires OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_REDIRECT_URI. */
router.get('/oidc', async (_req, res) => {
  if (!env.OIDC_ISSUER || !env.OIDC_CLIENT_ID || !env.OIDC_REDIRECT_URI) {
    res.status(501).json({ error: 'SSO not configured' });
    return;
  }
  try {
    const { url, state } = await oidcService.getAuthorizationUrl();
    res.cookie(OIDC_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: OIDC_STATE_MAX_AGE,
    });
    res.redirect(302, url);
  } catch (e) {
    console.error('[oidc] Redirect failed:', e);
    res.status(502).json({ error: 'SSO redirect failed' });
  }
});

/** SSO: callback from IdP. Exchange code, find/create user, set session, redirect to /. */
router.get('/oidc/callback', async (req, res) => {
  if (!env.OIDC_ISSUER) {
    res.redirect(302, '/login?error=sso_not_configured');
    return;
  }
  const state = req.query.state as string;
  const code = req.query.code as string;
  const savedState = req.cookies?.[OIDC_STATE_COOKIE];
  res.clearCookie(OIDC_STATE_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
  if (!state || state !== savedState || !code) {
    res.redirect(302, '/login?error=invalid_callback');
    return;
  }
  const user = await oidcService.exchangeCodeForUser(code);
  if (!user) {
    res.redirect(302, '/login?error=sso_no_user');
    return;
  }
  const token = oidcService.signToken(user);
  res.cookie(env.SESSION_COOKIE_NAME, token, COOKIE_OPTIONS);
  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'auth_login',
    details: { role: user.role, method: 'oidc' },
    ipAddress: getClientIp(req),
  });
  res.redirect(302, '/');
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
