import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { audit, getClientIp } from '../services/auditService.js';

const router = Router();
router.use(authMiddleware);

const createSchema = z.object({ name: z.string().min(1), capacity: z.number().int().min(0).optional() });
const updateSchema = z.object({ name: z.string().min(1).optional(), capacity: z.number().int().min(0).optional() });

router.get('/', requireRoles('admin', 'faculty'), async (_req, res) => {
  const r = await pool.query('SELECT id, name, capacity, created_at FROM classrooms ORDER BY name');
  res.json(r.rows);
});

router.post('/', requireRoles('admin'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const { name, capacity } = parsed.data;
  try {
    const insert = await pool.query(
      'INSERT INTO classrooms (name, capacity) VALUES ($1, $2) RETURNING id, name, capacity, created_at',
      [name, capacity ?? null]
    );
    const row = insert.rows[0];
    await audit({
      actorId: (req as AuthRequest).user?.userId,
      actorEmail: (req as AuthRequest).user?.email,
      action: 'classroom_create',
      resourceType: 'classroom',
      resourceId: row?.id,
      details: { name },
      ipAddress: getClientIp(req),
    });
    res.status(201).json(row);
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === '23505') {
      res.status(409).json({ error: 'Classroom name already exists' });
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
  if (parsed.data.name !== undefined) {
    updates.push(`name = $${i++}`);
    values.push(parsed.data.name);
  }
  if (parsed.data.capacity !== undefined) {
    updates.push(`capacity = $${i++}`);
    values.push(parsed.data.capacity);
  }
  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }
  values.push(id);
  const r = await pool.query(
    `UPDATE classrooms SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, name, capacity, created_at`,
    values
  );
  if (r.rows.length === 0) {
    res.status(404).json({ error: 'Classroom not found' });
    return;
  }
  await audit({
    actorId: (req as AuthRequest).user?.userId,
    actorEmail: (req as AuthRequest).user?.email,
    action: 'classroom_update',
    resourceType: 'classroom',
    resourceId: id,
    ipAddress: getClientIp(req),
  });
  res.json(r.rows[0]);
});

router.delete('/:id', requireRoles('admin'), async (req, res) => {
  const { id } = req.params;
  const r = await pool.query('DELETE FROM classrooms WHERE id = $1 RETURNING id', [id]);
  if (r.rows.length === 0) {
    res.status(404).json({ error: 'Classroom not found' });
    return;
  }
  await audit({
    actorId: (req as AuthRequest).user?.userId,
    actorEmail: (req as AuthRequest).user?.email,
    action: 'classroom_delete',
    resourceType: 'classroom',
    resourceId: id,
    ipAddress: getClientIp(req),
  });
  res.status(204).send();
});

export default router;
