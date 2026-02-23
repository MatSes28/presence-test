import { Router } from 'express';
import { z } from 'zod';
import { ingestAttendance } from '../services/attendanceValidation.js';

const router = Router();

const payloadSchema = z.object({
  card_uid: z.string().min(1),
  proximity_cm: z.number().min(0),
  device_id: z.string().optional(),
  session_id: z.string().uuid().optional(),
});

/**
 * IoT ingestion endpoint: ESP32 sends RFID + proximity data (REST).
 * If session_id is omitted, the current active session is used.
 * Devices can also use WebSocket /iot for attendance + heartbeat.
 */
router.post('/attendance', async (req, res) => {
  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
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

export default router;
