import { pool } from '../db/pool.js';

export type DeleteUserResult = { ok: true } | { ok: false; reason: string };

/**
 * Delete a user and all their data (right-to-erasure / world-class retention).
 * Students: delete attendance_events for user, then user (cascades rfid_cards, email_notifications).
 * Faculty: allowed only if they have no schedules; otherwise returns error.
 * Audit log and discrepancy_flags keep references as SET NULL.
 */
export async function deleteUser(userId: string): Promise<DeleteUserResult> {
  const client = await pool.connect();
  try {
    const userRow = await client.query(
      'SELECT id, email, role, full_name FROM users WHERE id = $1',
      [userId]
    );
    if (userRow.rows.length === 0) {
      return { ok: false, reason: 'User not found' };
    }
    const user = userRow.rows[0];
    if (user.role === 'faculty' || user.role === 'admin') {
      const schedules = await client.query(
        'SELECT id FROM schedules WHERE faculty_id = $1 LIMIT 1',
        [userId]
      );
      if (schedules.rows.length > 0) {
        return { ok: false, reason: 'Cannot delete user who has schedules. Reassign or delete schedules first.' };
      }
    }
    await client.query('DELETE FROM attendance_events WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
    return { ok: true };
  } finally {
    client.release();
  }
}
