import { Resend } from 'resend';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';

function getResendClient(): Resend | null {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return null;
  return new Resend(env.RESEND_API_KEY);
}

/** Log a notification and send via Resend when RESEND_API_KEY and EMAIL_FROM are set. */
export async function notifyGuardian(params: {
  userId: string;
  sessionId?: string;
  recipientEmail: string;
  studentName: string;
  kind?: string;
}): Promise<void> {
  const { userId, sessionId, recipientEmail, studentName, kind = 'attendance' } = params;
  const payload = { studentName, sessionId, at: new Date().toISOString() };
  let status: 'sent' | 'failed' = 'sent';
  const resend = getResendClient();
  if (resend) {
    try {
      const { error } = await resend.emails.send({
        from: env.EMAIL_FROM,
        to: recipientEmail,
        subject: `Attendance: ${studentName}`,
        html: `<p>${studentName} was recorded as present${sessionId ? ` for session ${sessionId}` : ''} at ${payload.at}.</p>`,
      });
      if (error) {
        status = 'failed';
        console.error('[notifyGuardian] Resend error:', error);
      }
    } catch (err) {
      status = 'failed';
      console.error('[notifyGuardian] Resend send failed:', err);
    }
  }
  await pool.query(
    `INSERT INTO email_notifications (user_id, session_id, kind, recipient, status, payload)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [userId, sessionId ?? null, kind, recipientEmail, status, JSON.stringify(payload)]
  );
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
