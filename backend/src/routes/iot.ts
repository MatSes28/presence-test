import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { validateAndRecordAttendance, getActiveSessionForDevice } from '../services/attendanceValidation.js';

const router = Router();

const payloadSchema = z.object({
  card_uid: z.string().min(1),
  proximity_cm: z.number().min(0),
  device_id: z.string().optional(),
  session_id: z.string().uuid().optional(),
});

/**
 * IoT ingestion endpoint: ESP32 sends RFID + proximity data.
 * If session_id is omitted, the current active session is used.
 */
router.post('/attendance', async (req, res) => {
  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }
  const { session_id, ...payload } = parsed.data;
  let sessionId: string | null = session_id ?? null;
  if (!sessionId) {
    sessionId = await getActiveSessionForDevice(payload.device_id);
    if (!sessionId) {
      res.status(400).json({ error: 'No active session; provide session_id or start a session' });
      return;
    }
  }
  const result = await validateAndRecordAttendance(
    { card_uid: payload.card_uid, proximity_cm: payload.proximity_cm, device_id: payload.device_id },
    sessionId as string
  );
  if (result.success && result.eventId) {
    const userRow = await pool.query(
      `SELECT u.id, u.full_name FROM users u JOIN rfid_cards r ON r.user_id = u.id WHERE r.card_uid = $1`,
      [payload.card_uid]
    );
    const full_name = userRow.rows[0]?.full_name ?? 'Unknown';
    const broadcast = req.app.get('wsBroadcast') as { broadcastAttendance: (e: { sessionId: string; userId: string; full_name: string; recorded_at: string }) => void } | undefined;
    if (broadcast?.broadcastAttendance) {
      broadcast.broadcastAttendance({
        sessionId,
        userId: userRow.rows[0]?.id ?? '',
        full_name,
        recorded_at: new Date().toISOString(),
      });
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
