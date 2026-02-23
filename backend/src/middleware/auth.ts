import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { UserRole } from '../types/index.js';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization' });
    return;
  }
  const token = auth.slice(7);
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
