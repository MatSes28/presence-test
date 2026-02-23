import { pool } from '../db/pool.js';

/** Log a notification (and optionally send via email provider). Guardian contact required for sending. */
export async function notifyGuardian(params: {
  userId: string;
  sessionId?: string;
  recipientEmail: string;
  studentName: string;
  kind?: string;
}): Promise<void> {
  const { userId, sessionId, recipientEmail, studentName, kind = 'attendance' } = params;
  const payload = { studentName, sessionId, at: new Date().toISOString() };
  await pool.query(
    `INSERT INTO email_notifications (user_id, session_id, kind, recipient, status, payload)
     VALUES ($1, $2, $3, $4, 'sent', $5::jsonb)`,
    [userId, sessionId ?? null, kind, recipientEmail, JSON.stringify(payload)]
  );
  // TODO: integrate transactional email (Resend, SendGrid, etc.) when configured
  // if (process.env.EMAIL_API_KEY) { await sendEmail({ to: recipientEmail, ... }); }
}

/** Load guardian_email for a user (student). */
export async function getGuardianEmail(userId: string): Promise<string | null> {
  const r = await pool.query(
    'SELECT guardian_email FROM users WHERE id = $1 AND role = $2',
    [userId, 'student']
  );
  const email = r.rows[0]?.guardian_email;
  return email && String(email).trim() ? String(email).trim() : null;
}
