import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import type { UserRole } from '../types/index.js';

let cachedConfig: { authorization_endpoint: string; token_endpoint: string; userinfo_endpoint: string } | null = null;

async function getOidcConfig() {
  if (cachedConfig) return cachedConfig;
  const res = await fetch(`${env.OIDC_ISSUER.replace(/\/$/, '')}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error('OIDC discovery failed');
  const body = await res.json();
  cachedConfig = {
    authorization_endpoint: body.authorization_endpoint,
    token_endpoint: body.token_endpoint,
    userinfo_endpoint: body.userinfo_endpoint,
  };
  return cachedConfig;
}

export function getOidcRedirectUrl(): string {
  return env.OIDC_REDIRECT_URI;
}

export async function getAuthorizationUrl(): Promise<{ url: string; state: string }> {
  const config = await getOidcConfig();
  const state = crypto.randomBytes(24).toString('hex');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.OIDC_CLIENT_ID,
    redirect_uri: env.OIDC_REDIRECT_URI,
    scope: env.OIDC_SCOPES,
    state,
  });
  return { url: `${config.authorization_endpoint}?${params}`, state };
}

export async function exchangeCodeForUser(code: string): Promise<{ id: string; email: string; role: UserRole; full_name: string } | null> {
  const config = await getOidcConfig();
  const tokenRes = await fetch(config.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.OIDC_REDIRECT_URI,
      client_id: env.OIDC_CLIENT_ID,
      client_secret: env.OIDC_CLIENT_SECRET,
    }),
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error('[oidc] Token exchange failed:', err);
    return null;
  }
  const tokens = await tokenRes.json();
  const accessToken = tokens.access_token;
  if (!accessToken) return null;

  const userRes = await fetch(config.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) return null;
  const profile = await userRes.json();
  const email = profile.email ?? profile.preferred_username;
  const full_name = profile.name ?? profile.preferred_username ?? email ?? 'User';
  if (!email) return null;

  const existing = await pool.query(
    'SELECT id, email, role, full_name FROM users WHERE email = $1',
    [email]
  );
  if (existing.rows.length > 0) {
    const u = existing.rows[0];
    return { id: u.id, email: u.email, role: u.role as UserRole, full_name: u.full_name };
  }
  if (!env.OIDC_CREATE_USER) return null;

  const role: UserRole = (profile.role as UserRole) ?? (profile.groups?.includes?.('admin') ? 'admin' : 'faculty');
  const hash = await bcrypt.hash('sso-' + crypto.randomUUID(), 10);
  const insert = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4)
     RETURNING id, email, role, full_name`,
    [email, hash, full_name, role]
  );
  const u = insert.rows[0];
  return { id: u.id, email: u.email, role: u.role as UserRole, full_name: u.full_name };
}

export function signToken(user: { id: string; email: string; role: UserRole }) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions
  );
}
