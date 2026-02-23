import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { ingestAttendance } from '../services/attendanceValidation.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import * as iotDeviceService from '../services/iotDeviceService.js';
import { audit, getClientIp } from '../services/auditService.js';

const router = Router();

const payloadSchema = z.object({
  card_uid: z.string().min(1),
  proximity_cm: z.number().min(0),
  device_id: z.string().optional(),
  api_key: z.string().optional(),
  session_id: z.string().uuid().optional(),
});

/**
 * IoT ingestion endpoint: ESP32 sends RFID + proximity data (REST).
 * If session_id is omitted, the current active session is used.
 * When IOT_REQUIRE_DEVICE_AUTH=1, device_id and API key (X-IoT-API-Key header or body.api_key) are required.
 */
router.post('/attendance', async (req, res) => {
  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }
  const apiKey = (req.headers['x-iot-api-key'] as string) || parsed.data.api_key;
  if (env.IOT_REQUIRE_DEVICE_AUTH) {
    if (!parsed.data.device_id || !apiKey) {
      res.status(401).json({ error: 'Device authentication required: device_id and X-IoT-API-Key (or api_key in body)' });
      return;
    }
    const valid = await iotDeviceService.verifyDeviceAuth(parsed.data.device_id, apiKey);
    if (!valid) {
      res.status(401).json({ error: 'Invalid or inactive device credentials' });
      return;
    }
  }
  const result = await ingestAttendance(parsed.data);
  if (result.success && result.eventId) {
    const broadcast = req.app.get('wsBroadcast') as { broadcastAttendance: (e: { sessionId: string; userId: string; full_name: string; recorded_at: string }) => void } | undefined;
    if (broadcast?.broadcastAttendance && result.broadcast) {
      broadcast.broadcastAttendance(result.broadcast);
    }
    res.status(201).json({ success: true, eventId: result.eventId });
    return;
  }
  if (result.reason === 'duplicate') {
    res.status(200).json({ success: false, reason: 'duplicate', eventId: result.eventId });
    return;
  }
  res.status(400).json({ success: false, reason: result.reason });
});

// ——— IoT device registry (admin) ———
router.get('/devices', authMiddleware, requireRoles('admin'), async (_req, res) => {
  const devices = await iotDeviceService.listDevices();
  res.json(devices);
});

const createDeviceSchema = z.object({
  device_id: z.string().min(1).max(100),
  name: z.string().max(255).optional(),
});

router.post('/devices', authMiddleware, requireRoles('admin'), async (req, res) => {
  const parsed = createDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  try {
    const device = await iotDeviceService.createDevice(parsed.data);
    await audit({
      actorId: (req as AuthRequest).user?.userId,
      actorEmail: (req as AuthRequest).user?.email,
      action: 'iot_device_create',
      resourceType: 'iot_device',
      resourceId: device.device_id,
      details: { name: parsed.data.name },
      ipAddress: getClientIp(req),
    });
    res.status(201).json(device);
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === '23505') {
      res.status(409).json({ error: 'Device ID already registered' });
      return;
    }
    throw e;
  }
});

const updateDeviceSchema = z.object({
  name: z.string().max(255).optional(),
  is_active: z.boolean().optional(),
});

router.patch('/devices/:id', authMiddleware, requireRoles('admin'), async (req, res) => {
  const parsed = updateDeviceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const device = await iotDeviceService.updateDevice(req.params.id, parsed.data);
  if (!device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }
  await audit({
    actorId: (req as AuthRequest).user?.userId,
    actorEmail: (req as AuthRequest).user?.email,
    action: 'iot_device_update',
    resourceType: 'iot_device',
    resourceId: device.device_id,
    details: parsed.data,
    ipAddress: getClientIp(req),
  });
  res.json(device);
});

router.delete('/devices/:id', authMiddleware, requireRoles('admin'), async (req, res) => {
  const id = req.params.id;
  const deleted = await iotDeviceService.deleteDevice(id);
  if (!deleted) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }
  await audit({
    actorId: (req as AuthRequest).user?.userId,
    actorEmail: (req as AuthRequest).user?.email,
    action: 'iot_device_delete',
    resourceType: 'iot_device',
    resourceId: id,
    ipAddress: getClientIp(req),
  });
  res.status(204).send();
});

export default router;
