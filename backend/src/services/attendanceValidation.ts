import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import type { IoTAttendancePayload } from '../types/index.js';

const PROXIMITY_MAX_CM = env.PROXIMITY_MAX_CM;
const GRACE_PERIOD_MINUTES = env.GRACE_PERIOD_MINUTES;
const LATE_CUTOFF_PCT = env.LATE_CUTOFF_PCT / 100;

export interface ValidationResult {
  valid: boolean;
  userId?: string;
  sessionId?: string;
  reason?: string;
}

/** Record a discrepancy flag (sensor mismatch, invalid session tap, multiple taps, etc.). */
export async function flagDiscrepancy(params: {
  sessionId: string;
  userId?: string;
  flagType: string;
  description?: string;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO discrepancy_flags (session_id, user_id, flag_type, description) VALUES ($1, $2, $3, $4)`,
      [params.sessionId, params.userId ?? null, params.flagType, params.description ?? null]
    );
  } catch {
    // table may not exist yet
  }
}

/** Compute attendance_status: present (within grace) or late (after grace but within 60% of session). */
function getAttendanceStatus(
  tapTime: Date,
  sessionStartedAt: Date,
  durationMinutes: number,
  graceMinutes: number
): 'present' | 'late' | 'invalid' {
  const elapsedMs = tapTime.getTime() - sessionStartedAt.getTime();
  const elapsedMinutes = elapsedMs / (60 * 1000);
  if (elapsedMinutes < 0) return 'invalid';
  if (elapsedMinutes <= graceMinutes) return 'present';
  const cutoffMinutes = durationMinutes * LATE_CUTOFF_PCT;
  if (elapsedMinutes <= cutoffMinutes) return 'late';
  return 'invalid';
}

/**
 * Validates IoT payload: RFID identity + proximity within range.
 * Computes Present (within grace) / Late (after grace, within 60% session). Flags discrepancies.
 */
export async function validateAndRecordAttendance(
  payload: IoTAttendancePayload,
  sessionId: string
): Promise<{ success: boolean; eventId?: string; reason?: string; attendanceStatus?: 'present' | 'late' }> {
  const { card_uid, proximity_cm } = payload;

  const proximityValid = proximity_cm >= 0 && proximity_cm <= PROXIMITY_MAX_CM;
  if (!proximityValid) {
    await flagDiscrepancy({ sessionId, flagType: 'sensor_mismatch', description: 'RFID tap without valid proximity' });
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
      `SELECT cs.id, cs.status, cs.started_at, s.start_time, s.end_time
       FROM class_sessions cs JOIN schedules s ON s.id = cs.schedule_id WHERE cs.id = $1`,
      [sessionId]
    );
    if (sessionResult.rows.length === 0) {
      return { success: false, reason: 'Session not found' };
    }
    if (sessionResult.rows[0].status !== 'active') {
      await flagDiscrepancy({ sessionId, userId, flagType: 'invalid_session_tap', description: 'Session not active' });
      return { success: false, reason: 'Session is not active' };
    }

    const existing = await client.query(
      `SELECT id FROM attendance_events WHERE session_id = $1 AND user_id = $2`,
      [sessionId, userId]
    );
    if (existing.rows.length > 0) {
      await flagDiscrepancy({ sessionId, userId, flagType: 'multiple_taps', description: 'Duplicate tap same session' });
      return { success: false, reason: 'duplicate', eventId: existing.rows[0].id };
    }

    const session = sessionResult.rows[0];
    const startedAt = new Date(session.started_at);
    const [sh, sm] = String(session.start_time).split(':').map(Number);
    const [eh, em] = String(session.end_time).split(':').map(Number);
    const durationMinutes = (eh * 60 + em) - (sh * 60 + sm) || 60;
    const tapTime = new Date();
    const attendanceStatus = getAttendanceStatus(tapTime, startedAt, durationMinutes, GRACE_PERIOD_MINUTES);

    if (attendanceStatus === 'invalid') {
      await flagDiscrepancy({
        sessionId,
        userId,
        flagType: 'invalid_session_tap',
        description: 'Tap after 60% session duration',
      });
      return { success: false, reason: 'Tap too late; outside allowed window' };
    }

    const insert = await client.query(
      `INSERT INTO attendance_events (session_id, user_id, rfid_uid, proximity_valid, distance_cm, status, attendance_status)
       VALUES ($1, $2, $3, true, $4, 'recorded', $5)
       RETURNING id`,
      [sessionId, userId, card_uid, proximity_cm, attendanceStatus]
    );
    const eventId = insert.rows[0].id;
    return { success: true, eventId, attendanceStatus };
  } finally {
    client.release();
  }
}

/**
 * Find active session for a room/device. Returns a session only when current time is within
 * the schedule's start_time–end_time window for that session date (time-based: IoT accepts
 * taps only during the scheduled class period).
 */
export async function getActiveSessionForDevice(deviceId?: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT cs.id FROM class_sessions cs
     JOIN schedules s ON s.id = cs.schedule_id
     WHERE cs.status = 'active'
       AND NOW() >= cs.started_at
       AND NOW() < cs.started_at + (s.end_time - s.start_time)
     ORDER BY cs.started_at DESC LIMIT 1`
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].id;
}

export interface IngestResult {
  success: boolean;
  eventId?: string;
  reason?: string;
  attendanceStatus?: 'present' | 'late';
  broadcast?: { sessionId: string; userId: string; full_name: string; recorded_at: string; attendanceStatus?: 'present' | 'late' };
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
  const attendanceStatus = result.attendanceStatus ?? 'present';
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
  if (payload.device_id) {
    try {
      const { touchDeviceLastSeen } = await import('./iotDeviceService.js');
      await touchDeviceLastSeen(payload.device_id);
    } catch {
      // device registry update is best-effort
    }
  }
  return {
    success: true,
    eventId: result.eventId,
    attendanceStatus,
    broadcast: {
      sessionId,
      userId,
      full_name,
      recorded_at: new Date().toISOString(),
      attendanceStatus,
    },
  };
}
