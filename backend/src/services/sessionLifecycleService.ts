import { pool } from '../db/pool.js';

const ABSENT_RFID_UID = 'ABSENT';

/**
 * Run every minute: activate scheduled sessions when start time is reached,
 * end active sessions when end time is reached, and mark absent any student
 * with no tap. Also close scheduled sessions whose time window has already
 * passed (e.g. server was down at 8 AM so they never activated).
 */
export async function runSessionLifecycle(): Promise<{
  activated: number;
  ended: number;
  absentMarked: number;
  closedPast: number;
}> {
  const client = await pool.connect();
  let activated = 0;
  let ended = 0;
  let absentMarked = 0;
  let closedPast = 0;
  try {
    // 0. Scheduled but window already passed (e.g. 8 AM session, now 11 PM): mark absent and set to ended so they don't stick as "upcoming"
    const pastScheduled = await client.query(
      `SELECT cs.id
       FROM class_sessions cs
       JOIN schedules s ON s.id = cs.schedule_id
       WHERE cs.status = 'scheduled'
         AND NOW() >= cs.started_at + (s.end_time - s.start_time)`
    );
    for (const row of pastScheduled.rows) {
      const sessionId = row.id;
      const absentResult = await client.query(
        `INSERT INTO attendance_events (session_id, user_id, rfid_uid, proximity_valid, distance_cm, status, attendance_status)
         SELECT $1, u.id, $2, false, NULL, 'recorded', 'absent'
         FROM users u
         JOIN rfid_cards r ON r.user_id = u.id AND r.is_active = true
         WHERE u.role = 'student'
           AND NOT EXISTS (SELECT 1 FROM attendance_events ae WHERE ae.session_id = $1 AND ae.user_id = u.id)`,
        [sessionId, ABSENT_RFID_UID]
      );
      absentMarked += absentResult.rowCount ?? 0;
    }
    if (pastScheduled.rows.length > 0) {
      const pastIds = pastScheduled.rows.map((r: { id: string }) => r.id);
      await client.query(
        `UPDATE class_sessions SET status = 'ended', ended_at = NOW() WHERE id = ANY($1::uuid[]) AND status = 'scheduled'`,
        [pastIds]
      );
      closedPast = pastScheduled.rows.length;
    }

    // 1. Activate: scheduled -> active when current time is within [started_at, started_at + duration)
    const activateResult = await client.query(
      `UPDATE class_sessions cs
       SET status = 'active'
       FROM schedules s
       WHERE s.id = cs.schedule_id
         AND cs.status = 'scheduled'
         AND NOW() >= cs.started_at
         AND NOW() < cs.started_at + (s.end_time - s.start_time)`
    );
    activated = activateResult.rowCount ?? 0;

    // 2. Find sessions that should be ended (active and past end time)
    const toEnd = await client.query(
      `SELECT cs.id
       FROM class_sessions cs
       JOIN schedules s ON s.id = cs.schedule_id
       WHERE cs.status = 'active'
         AND NOW() >= cs.started_at + (s.end_time - s.start_time)`
    );

    for (const row of toEnd.rows) {
      const sessionId = row.id;
      // Insert absent for students (with RFID) who have no attendance_event for this session
      const absentResult = await client.query(
        `INSERT INTO attendance_events (session_id, user_id, rfid_uid, proximity_valid, distance_cm, status, attendance_status)
         SELECT $1, u.id, $2, false, NULL, 'recorded', 'absent'
         FROM users u
         JOIN rfid_cards r ON r.user_id = u.id AND r.is_active = true
         WHERE u.role = 'student'
           AND NOT EXISTS (SELECT 1 FROM attendance_events ae WHERE ae.session_id = $1 AND ae.user_id = u.id)`,
        [sessionId, ABSENT_RFID_UID]
      );
      absentMarked += absentResult.rowCount ?? 0;
    }

    // 3. End those sessions
    if (toEnd.rows.length > 0) {
      const sessionIds = toEnd.rows.map((r: { id: string }) => r.id);
      const endResult = await client.query(
        `UPDATE class_sessions
         SET status = 'ended', ended_at = NOW()
         WHERE id = ANY($1::uuid[]) AND status = 'active'`,
        [sessionIds]
      );
      ended = endResult.rowCount ?? 0;
    }
  } finally {
    client.release();
  }
  return { activated, ended, absentMarked, closedPast };
}
