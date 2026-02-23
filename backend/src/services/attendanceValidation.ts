import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import type { IoTAttendancePayload } from '../types/index.js';

const PROXIMITY_MAX_CM = env.PROXIMITY_MAX_CM;
const VALIDATION_WINDOW_MS = env.VALIDATION_WINDOW_MS;

export interface ValidationResult {
  valid: boolean;
  userId?: string;
  sessionId?: string;
  reason?: string;
}

/**
 * Validates IoT payload: RFID identity + proximity within range.
 * Only accepts if both conditions are met and session is active.
 */
export async function validateAndRecordAttendance(
  payload: IoTAttendancePayload,
  sessionId: string
): Promise<{ success: boolean; eventId?: string; reason?: string }> {
  const { card_uid, proximity_cm } = payload;

  const proximityValid = proximity_cm >= 0 && proximity_cm <= PROXIMITY_MAX_CM;
  if (!proximityValid) {
    return { success: false, reason: 'Proximity out of range' };
  }

  const client = await pool.connect();
  try {
    const cardResult = await client.query(
      `SELECT user_id FROM rfid_cards WHERE card_uid = $1 AND is_active = true`,
      [card_uid]
    );
    if (cardResult.rows.length === 0) {
      return { success: false, reason: 'Unknown or inactive RFID card' };
    }
    const userId = cardResult.rows[0].user_id;

    const sessionResult = await client.query(
      `SELECT id, status FROM class_sessions WHERE id = $1`,
      [sessionId]
    );
    if (sessionResult.rows.length === 0) {
      return { success: false, reason: 'Session not found' };
    }
    if (sessionResult.rows[0].status !== 'active') {
      return { success: false, reason: 'Session is not active' };
    }

    const existing = await client.query(
      `SELECT id FROM attendance_events WHERE session_id = $1 AND user_id = $2`,
      [sessionId, userId]
    );
    if (existing.rows.length > 0) {
      return { success: false, reason: 'duplicate', eventId: existing.rows[0].id };
    }

    const insert = await client.query(
      `INSERT INTO attendance_events (session_id, user_id, rfid_uid, proximity_valid, distance_cm, status)
       VALUES ($1, $2, $3, true, $4, 'recorded')
       RETURNING id`,
      [sessionId, userId, card_uid, proximity_cm]
    );
    const eventId = insert.rows[0].id;
    return { success: true, eventId };
  } finally {
    client.release();
  }
}

/**
 * Find active session for a room/device (optional: by schedule and time window).
 */
export async function getActiveSessionForDevice(deviceId?: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT id FROM class_sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1`
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].id;
}

export interface IngestResult {
  success: boolean;
  eventId?: string;
  reason?: string;
  broadcast?: { sessionId: string; userId: string; full_name: string; recorded_at: string };
}

/** Resolve session, validate, record. Optionally notifies guardian if configured. */
export async function ingestAttendance(payload: {
  card_uid: string;
  proximity_cm: number;
  device_id?: string;
  session_id?: string;
}): Promise<IngestResult> {
  let sessionId: string | null = payload.session_id ?? null;
  if (!sessionId) {
    sessionId = await getActiveSessionForDevice(payload.device_id);
    if (!sessionId) {
      return { success: false, reason: 'No active session' };
    }
  }
  const result = await validateAndRecordAttendance(
    { card_uid: payload.card_uid, proximity_cm: payload.proximity_cm, device_id: payload.device_id },
    sessionId
  );
  if (!result.success) {
    return { success: false, reason: result.reason, eventId: result.eventId };
  }
  const userRow = await pool.query(
    `SELECT u.id, u.full_name FROM users u JOIN rfid_cards r ON r.user_id = u.id WHERE r.card_uid = $1`,
    [payload.card_uid]
  );
  const full_name = userRow.rows[0]?.full_name ?? 'Unknown';
  const userId = userRow.rows[0]?.id ?? '';
  try {
    const { getGuardianEmail, notifyGuardian } = await import('./notificationService.js');
    const guardianEmail = await getGuardianEmail(userId);
    if (guardianEmail) {
      await notifyGuardian({
        userId,
        sessionId,
        recipientEmail: guardianEmail,
        studentName: full_name,
        kind: 'attendance',
      });
    }
  } catch {
    // notification is best-effort
  }
  return {
    success: true,
    eventId: result.eventId,
    broadcast: {
      sessionId,
      userId,
      full_name,
      recorded_at: new Date().toISOString(),
    },
  };
}
