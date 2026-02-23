import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { audit, getClientIp } from '../services/auditService.js';

const router = Router();
router.use(authMiddleware);

const createSchema = z.object({ name: z.string().min(1), room: z.string().optional(), is_active: z.boolean().optional() });
const updateSchema = z.object({ name: z.string().min(1).optional(), room: z.string().optional(), is_active: z.boolean().optional() });
const assignSchema = z.object({ user_id: z.string().uuid() });

router.get('/', requireRoles('admin', 'faculty'), async (_req, res) => {
  const r = await pool.query(
    `SELECT c.id, c.name, c.room, c.is_active, c.created_at,
      ca.user_id AS assigned_user_id, u.full_name AS assigned_user_name
     FROM computers c
     LEFT JOIN computer_assignments ca ON ca.computer_id = c.id AND ca.released_at IS NULL
     LEFT JOIN users u ON u.id = ca.user_id
     ORDER BY c.name`
  );
  res.json(r.rows);
});

router.post('/', requireRoles('admin'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const { name, room, is_active } = parsed.data;
  const insert = await pool.query(
    'INSERT INTO computers (name, room, is_active) VALUES ($1, $2, $3) RETURNING id, name, room, is_active, created_at',
    [name, room ?? null, is_active ?? true]
  );
  const row = insert.rows[0];
  await audit({
    actorId: (req as AuthRequest).user?.userId,
    actorEmail: (req as AuthRequest).user?.email,
    action: 'computer_create',
    resourceType: 'computer',
    resourceId: row?.id,
    details: { name },
    ipAddress: getClientIp(req),
  });
  res.status(201).json(row);
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
  if (parsed.data.room !== undefined) {
    updates.push(`room = $${i++}`);
    values.push(parsed.data.room);
  }
  if (parsed.data.is_active !== undefined) {
    updates.push(`is_active = $${i++}`);
    values.push(parsed.data.is_active);
  }
  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }
  values.push(id);
  const r = await pool.query(
    `UPDATE computers SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, name, room, is_active, created_at`,
    values
  );
  if (r.rows.length === 0) {
    res.status(404).json({ error: 'Computer not found' });
    return;
  }
  await audit({
    actorId: (req as AuthRequest).user?.userId,
    actorEmail: (req as AuthRequest).user?.email,
    action: 'computer_update',
    resourceType: 'computer',
    resourceId: id,
    ipAddress: getClientIp(req),
  });
  res.json(r.rows[0]);
});

router.delete('/:id', requireRoles('admin'), async (req, res) => {
  const { id } = req.params;
  const r = await pool.query('DELETE FROM computers WHERE id = $1 RETURNING id', [id]);
  if (r.rows.length === 0) {
    res.status(404).json({ error: 'Computer not found' });
    return;
  }
  await audit({
    actorId: (req as AuthRequest).user?.userId,
    actorEmail: (req as AuthRequest).user?.email,
    action: 'computer_delete',
    resourceType: 'computer',
    resourceId: id,
    ipAddress: getClientIp(req),
  });
  res.status(204).send();
});

/** Assign a user (student) to this computer. Replaces existing assignment. */
router.post('/:id/assign', requireRoles('admin', 'faculty'), async (req, res) => {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const { id } = req.params;
  const { user_id } = parsed.data;
  const up = await pool.query(
    'UPDATE computer_assignments SET user_id = $2, assigned_at = NOW(), released_at = NULL WHERE computer_id = $1 RETURNING id',
    [id, user_id]
  );
  if (up.rows.length === 0) {
    await pool.query('INSERT INTO computer_assignments (computer_id, user_id) VALUES ($1, $2)', [id, user_id]);
  }
  const r = await pool.query(
    'SELECT c.id, c.name, ca.user_id AS assigned_user_id, u.full_name AS assigned_user_name FROM computers c LEFT JOIN computer_assignments ca ON ca.computer_id = c.id AND ca.released_at IS NULL LEFT JOIN users u ON u.id = ca.user_id WHERE c.id = $1',
    [id]
  );
  await audit({
    actorId: (req as AuthRequest).user?.userId,
    actorEmail: (req as AuthRequest).user?.email,
    action: 'computer_assign',
    resourceType: 'computer',
    resourceId: id,
    details: { user_id },
    ipAddress: getClientIp(req),
  });
  res.json(r.rows[0] ?? { id, assigned_user_id: user_id });
});

/** Release assignment for this computer. */
router.post('/:id/release', requireRoles('admin', 'faculty'), async (req, res) => {
  const { id } = req.params;
  const r = await pool.query('UPDATE computer_assignments SET released_at = NOW() WHERE computer_id = $1 AND released_at IS NULL RETURNING id', [id]);
  if (r.rows.length === 0) {
    res.status(404).json({ error: 'No active assignment for this computer' });
    return;
  }
  await audit({
    actorId: (req as AuthRequest).user?.userId,
    actorEmail: (req as AuthRequest).user?.email,
    action: 'computer_release',
    resourceType: 'computer',
    resourceId: id,
    ipAddress: getClientIp(req),
  });
  res.json({ ok: true });
});

export default router;
