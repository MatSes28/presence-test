import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { audit, getClientIp } from '../services/auditService.js';

const router = Router();
router.use(authMiddleware);

const createSchema = z.object({ code: z.string().min(1), name: z.string().min(1) });
const updateSchema = z.object({ code: z.string().min(1).optional(), name: z.string().min(1).optional() });

router.get('/', requireRoles('admin', 'faculty'), async (_req, res) => {
  const r = await pool.query('SELECT id, code, name, created_at FROM subjects ORDER BY code');
  res.json(r.rows);
});

router.post('/', requireRoles('admin'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const { code, name } = parsed.data;
  try {
    const insert = await pool.query(
      'INSERT INTO subjects (code, name) VALUES ($1, $2) RETURNING id, code, name, created_at',
      [code, name]
    );
    const row = insert.rows[0];
    await audit({
      actorId: (req as AuthRequest).user?.userId,
      actorEmail: (req as AuthRequest).user?.email,
      action: 'subject_create',
      resourceType: 'subject',
      resourceId: row?.id,
      details: { code, name },
      ipAddress: getClientIp(req),
    });
    res.status(201).json(row);
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === '23505') {
      res.status(409).json({ error: 'Subject code already exists' });
      return;
    }
    throw e;
  }
});

router.put('/:id', requireRoles('admin'), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const { id } = req.params;
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (parsed.data.code !== undefined) {
    updates.push(`code = $${i++}`);
    values.push(parsed.data.code);
  }
  if (parsed.data.name !== undefined) {
    updates.push(`name = $${i++}`);
    values.push(parsed.data.name);
  }
  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }
  values.push(id);
  const r = await pool.query(
    `UPDATE subjects SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, code, name, created_at`,
    values
  );
  if (r.rows.length === 0) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }
  await audit({
    actorId: (req as AuthRequest).user?.userId,
    actorEmail: (req as AuthRequest).user?.email,
    action: 'subject_update',
    resourceType: 'subject',
    resourceId: id,
    ipAddress: getClientIp(req),
  });
  res.json(r.rows[0]);
});

router.delete('/:id', requireRoles('admin'), async (req, res) => {
  const { id } = req.params;
  const r = await pool.query('DELETE FROM subjects WHERE id = $1 RETURNING id', [id]);
  if (r.rows.length === 0) {
    res.status(404).json({ error: 'Subject not found' });
    return;
  }
  await audit({
    actorId: (req as AuthRequest).user?.userId,
    actorEmail: (req as AuthRequest).user?.email,
    action: 'subject_delete',
    resourceType: 'subject',
    resourceId: id,
    ipAddress: getClientIp(req),
  });
  res.status(204).send();
});

export default router;
