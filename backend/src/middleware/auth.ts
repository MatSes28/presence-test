import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { UserRole } from '../types/index.js';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export type AuthRequest = Request & { user: JwtPayload };

function getTokenFromRequest(req: Request): string | null {
  const cookieToken = req.cookies?.[env.SESSION_COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'Missing or invalid authorization' });
    return;
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    (req as Request & { user: JwtPayload }).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user: JwtPayload }).user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}
